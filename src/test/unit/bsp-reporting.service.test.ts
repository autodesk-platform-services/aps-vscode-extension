import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BSP_REPORTING_SCOPES, BspReportingService } from '../../services/bsp-reporting';
import { EntryType } from '../../models/bsp-reporting';

interface IRecordedRequest {
	url: string;
	method?: string;
	body?: any;
	headers?: Record<string, string>;
}

const noHeaders = { forEach: () => {} };

function okResponse(data: any) {
	return { ok: true, status: 200, text: async () => data === undefined ? '' : JSON.stringify(data), headers: noHeaders };
}

const completedExport = {
	id: 'e1',
	timestamp: '2026-11-03T22:10:56Z',
	downloads: [{ type: 'SUBSCRIPTIONS', downloadURL: 'https://s3.example.com/presigned' }],
	status: 'COMPLETED',
	outputFormat: 'CSV',
	teamId: null,
	teamName: null,
	reports: ['SUBSCRIPTIONS']
};

describe('BspReportingService', () => {
	const originalFetch = global.fetch;
	let requests: IRecordedRequest[];
	let requestedScopes: string[] | undefined;
	const authProvider = { getAccessToken: async (scopes?: string[]) => { requestedScopes = scopes; return 'user-token'; } };

	function mockFetch(handler: (url: string, method?: string) => any) {
		global.fetch = (async (url: string, init: any) => {
			requests.push({ url, method: init?.method, body: init?.body ? JSON.parse(init.body) : undefined, headers: init?.headers });
			return handler(url, init?.method);
		}) as any;
	}

	beforeEach(() => {
		requests = [];
		requestedScopes = undefined;
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it('lists teams as sorted tree entries using a user token', async () => {
		mockFetch(() => okResponse([
			{ contextId: '2', alias: 'Team Omega', reportingBenefits: ['InsightsTeam'] },
			{ contextId: '1', alias: 'New York Office', reportingBenefits: ['ReportingAPIAccess'] }
		]));

		const service = new BspReportingService(authProvider as any, 'https://example.com');
		const teams = await service.getTeams();

		assert.deepStrictEqual(teams.map(team => team.alias), ['New York Office', 'Team Omega']);
		assert.strictEqual(teams[0].type, EntryType.Team);
		assert.strictEqual(requests[0].url, 'https://example.com/insights/v1/contexts');
		assert.strictEqual(requests[0].headers?.Authorization, 'Bearer user-token');
		assert.deepStrictEqual(requestedScopes, BSP_REPORTING_SCOPES);
	});

	it('runs a usage query: submits, polls until completed, and collects all result pages', async () => {
		let polls = 0;
		mockFetch((url, method) => {
			if (method === 'POST') {
				return okResponse({ id: 'q1', status: 'SUBMITTED', startTime: 1636578859 });
			}
			if (url.includes('offset=0')) {
				polls++;
				return polls === 1
					? okResponse({ id: 'q1', status: 'RUNNING' })
					: okResponse({ id: 'q1', status: 'COMPLETED', columns: ['productName', 'uniqueUsers'], rows: [['Maya', 1]], pagination: { totalResults: 2, offset: 0, limit: 1 } });
			}
			return okResponse({ id: 'q1', status: 'COMPLETED', columns: ['productName', 'uniqueUsers'], rows: [['AutoCAD', 2]], pagination: { totalResults: 2, offset: 1, limit: 1 } });
		});

		const statuses: string[] = [];
		const service = new BspReportingService(authProvider as any, 'https://example.com');
		const query = { fields: ['productName'], metrics: ['uniqueUsers'], contextId: '4314051' };
		const result = await service.runUsageQuery(query, { pollIntervalMs: 0, onStatus: status => statuses.push(status) });

		assert.deepStrictEqual(result, { id: 'q1', columns: ['productName', 'uniqueUsers'], rows: [['Maya', 1], ['AutoCAD', 2]] });
		assert.strictEqual(requests[0].url, 'https://example.com/insights/v1/usage-queries?offset=0&limit=100&contextId=4314051');
		assert.deepStrictEqual(requests[0].body, query);
		assert.strictEqual(requests[1].url, 'https://example.com/insights/v1/usage-queries/q1?offset=0&limit=100');
		assert.strictEqual(requests[3].url, 'https://example.com/insights/v1/usage-queries/q1?offset=1&limit=100');
		assert.deepStrictEqual(statuses, ['SUBMITTED', 'RUNNING', 'COMPLETED']);
	});

	it('throws when a usage query fails', async () => {
		mockFetch((_url, method) => method === 'POST'
			? okResponse({ id: 'q1', status: 'SUBMITTED' })
			: okResponse({ id: 'q1', status: 'ERROR' }));

		const service = new BspReportingService(authProvider as any, 'https://example.com');
		await assert.rejects(service.runUsageQuery({ metrics: ['uniqueUsers'] }, { pollIntervalMs: 0 }), /ERROR/);
	});

	it('lists exports across pages, newest first', async () => {
		mockFetch(url => url.includes('offset=0')
			? okResponse({ exports: [{ ...completedExport, id: 'old', timestamp: '2026-10-25T22:31:13Z' }], pagination: { offset: 0, limit: 1, totalResults: 2 } })
			: okResponse({ exports: [{ ...completedExport, id: 'new' }], pagination: { offset: 1, limit: 1, totalResults: 2 } }));

		const service = new BspReportingService(authProvider as any, 'https://example.com');
		const exports = await service.getExports('t1');

		assert.deepStrictEqual(exports.map(item => item.id), ['new', 'old']);
		assert.strictEqual(exports[0].type, EntryType.Export);
		assert.strictEqual(requests[0].url, 'https://example.com/insights/v1/exports?offset=0&limit=100&teamId=t1');
		assert.strictEqual(requests[1].url, 'https://example.com/insights/v1/exports?offset=1&limit=100&teamId=t1');
	});

	it('runs an export until it completes', async () => {
		mockFetch((_url, method) => method === 'POST'
			? okResponse({ ...completedExport, downloads: [], status: 'SUBMITTED' })
			: okResponse(completedExport));

		const service = new BspReportingService(authProvider as any, 'https://example.com');
		const request = { outputFormat: 'CSV' as const, reports: ['SUBSCRIPTIONS' as const] };
		const result = await service.runExport(request, { pollIntervalMs: 0 });

		assert.strictEqual(result.status, 'COMPLETED');
		assert.deepStrictEqual(requests[0], { url: 'https://example.com/insights/v1/exports', method: 'POST', body: request, headers: requests[0].headers });
		assert.strictEqual(requests[1].url, 'https://example.com/insights/v1/exports/e1');
	});

	it('maps downloads without their expiring URLs', () => {
		const service = new BspReportingService(authProvider as any, 'https://example.com');
		assert.deepStrictEqual(service.getDownloads(completedExport as any), [
			{ type: EntryType.Download, reportType: 'SUBSCRIPTIONS', exportId: 'e1', outputFormat: 'CSV' }
		]);
	});

	it('downloads an export file via a fresh pre-signed URL, without the bearer token', async () => {
		mockFetch(url => url.startsWith('https://s3.example.com')
			? { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('a,b\n1,2\n').buffer }
			: okResponse(completedExport));

		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsp-reporting-'));
		const filePath = path.join(dir, 'subscriptions.csv');
		try {
			const service = new BspReportingService(authProvider as any, 'https://example.com');
			await service.downloadExport('e1', 'SUBSCRIPTIONS', filePath);

			assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'a,b\n1,2\n');
			assert.strictEqual(requests[0].url, 'https://example.com/insights/v1/exports/e1');
			assert.strictEqual(requests[1].url, 'https://s3.example.com/presigned');
			assert.strictEqual(requests[1].headers, undefined);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
