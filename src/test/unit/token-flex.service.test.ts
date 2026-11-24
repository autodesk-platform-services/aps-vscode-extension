import * as assert from 'assert';
import { TOKEN_FLEX_SCOPES, TokenFlexService } from '../../services/token-flex';
import { EntryType } from '../../models/token-flex';

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

describe('TokenFlexService', () => {
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

	it('lists contracts as tree entries using a data:read user token', async () => {
		const contract = { contractNumber: '110000917988', contractName: 'Autodesk Inc', contractStartDate: '2015-04-28', contractEndDate: '2019-03-10', isActive: true };
		mockFetch(() => okResponse([contract]));

		const service = new TokenFlexService(authProvider as any, 'https://example.com');
		const contracts = await service.getContracts();

		assert.deepStrictEqual(contracts, [{ ...contract, type: EntryType.Contract }]);
		assert.strictEqual(requests[0].url, 'https://example.com/tokenflex/v1/contract');
		assert.strictEqual(requests[0].headers?.Authorization, 'Bearer user-token');
		assert.deepStrictEqual(requestedScopes, TOKEN_FLEX_SCOPES);
	});

	it('maps contract years of a contract', async () => {
		mockFetch(() => okResponse({
			contractNumber: 'c1',
			contractYears: [{ year: 1, startDate: '2015-04-28', endDate: '2016-04-27', provisionedTokens: 10, consumedTokens: 4, remainingTokens: 6 }]
		}));

		const service = new TokenFlexService(authProvider as any, 'https://example.com');
		const years = await service.getContractYears('c1');

		assert.strictEqual(requests[0].url, 'https://example.com/tokenflex/v1/contract/c1');
		assert.deepStrictEqual(years, [{ year: 1, startDate: '2015-04-28', endDate: '2016-04-27', provisionedTokens: 10, consumedTokens: 4, remainingTokens: 6, type: EntryType.ContractYear, contractNumber: 'c1' }]);
	});

	it('passes usage summary filters and sorts newest month first', async () => {
		mockFetch(() => okResponse([
			{ usageMonth: '2015-01-01', contractYear: 1, usageCategory: 'CLOUD_CONSUMPTION', uniqueUsers: 2, tokensConsumed: 5 },
			{ usageMonth: '2015-02-01', contractYear: 1, usageCategory: 'MANUAL_ADJUSTMENT', uniqueUsers: 1, tokensConsumed: 15883 }
		]));

		const service = new TokenFlexService(authProvider as any, 'https://example.com');
		const summary = await service.getUsageSummary('c1', { contractYear: 1, usageCategory: undefined });

		assert.strictEqual(requests[0].url, 'https://example.com/tokenflex/v1/usage/c1/summary?contractYear=1');
		assert.deepStrictEqual(summary.map(entry => entry.usageMonth), ['2015-02-01', '2015-01-01']);
		assert.strictEqual(summary[0].type, EntryType.UsageSummary);
		assert.strictEqual(summary[0].contractNumber, 'c1');
	});

	it('runs a usage query: submits, polls until done, and collects all result pages', async () => {
		let polls = 0;
		mockFetch((url, method) => {
			if (method === 'POST') {
				return okResponse({ status: 'QUEUED', id: 'query:abc', detail_uri: '/tokenflex/v1/usage/c1/query/query:abc' });
			}
			if (url.includes('offset=0')) {
				polls++;
				return polls === 1
					? okResponse({ id: 'query:abc', status: 'PROCESSING' })
					: okResponse({ id: 'query:abc', status: 'DONE', result: { columns: ['productName', 'tokensConsumed'], rows: [['Revit', 10]], total: 2, offset: 0, limit: 1 } });
			}
			return okResponse({ id: 'query:abc', status: 'DONE', result: { columns: ['productName', 'tokensConsumed'], rows: [['AutoCAD', 5]], total: 2, offset: 1, limit: 1 } });
		});

		const statuses: string[] = [];
		const service = new TokenFlexService(authProvider as any, 'https://example.com');
		const query = { fields: ['productName'], metrics: ['tokensConsumed'] };
		const result = await service.runUsageQuery('c1', query, { pollIntervalMs: 0, onStatus: status => statuses.push(status) });

		assert.deepStrictEqual(result, { id: 'query:abc', columns: ['productName', 'tokensConsumed'], rows: [['Revit', 10], ['AutoCAD', 5]] });
		assert.deepStrictEqual(requests[0], { url: 'https://example.com/tokenflex/v1/usage/c1/query', method: 'POST', body: query, headers: requests[0].headers });
		assert.strictEqual(requests[1].url, 'https://example.com/tokenflex/v1/usage/c1/query/query%3Aabc?offset=0&limit=1000');
		assert.strictEqual(requests[3].url, 'https://example.com/tokenflex/v1/usage/c1/query/query%3Aabc?offset=1&limit=1000');
		assert.deepStrictEqual(statuses, ['QUEUED', 'PROCESSING', 'DONE']);
	});

	it('returns cached query results without polling', async () => {
		mockFetch(() => okResponse({ id: 'q1', status: 'DONE', result: { columns: ['uniqueUsers'], rows: [[42]], total: 1, offset: 0, limit: 100 } }));

		const service = new TokenFlexService(authProvider as any, 'https://example.com');
		const result = await service.runUsageQuery('c1', { metrics: ['uniqueUsers'] }, { pollIntervalMs: 0 });

		assert.deepStrictEqual(result.rows, [[42]]);
		assert.strictEqual(requests.length, 1);
	});

	it('throws when a usage query fails', async () => {
		mockFetch((_url, method) => method === 'POST'
			? okResponse({ id: 'q1', status: 'QUEUED' })
			: okResponse({ id: 'q1', status: 'FAILED' }));

		const service = new TokenFlexService(authProvider as any, 'https://example.com');
		await assert.rejects(service.runUsageQuery('c1', { metrics: ['tokensConsumed'] }, { pollIntervalMs: 0 }), /FAILED/);
	});
});
