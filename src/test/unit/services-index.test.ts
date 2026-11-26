import * as assert from 'assert';
import * as http from 'http';
import { createServices } from '../../services';
import { OssService } from '../../services/oss';
import { WebhooksService } from '../../services/webhooks';
import { HubsService } from '../../services/hubs';
import { ModelDerivativeService } from '../../services/model-derivative';
import { DesignAutomationService } from '../../services/design-automation';
import { SecureServiceAccountsService } from '../../services/secure-service-accounts';
import { AuthenticationService } from '../../services/authentication';
import { StaticTokenAuthenticationProvider } from '../../services/static-token-authentication-provider';

const FAKE_ENV = {
	title: 'Test Environment',
	clientId: 'fake-client-id',
	clientSecret: 'fake-client-secret'
};

describe('createServices', () => {
	it('wires up every service from a plain environment (2-legged)', () => {
		const services = createServices(FAKE_ENV);
		assert.ok(services.authenticationService instanceof AuthenticationService);
		assert.ok(services.ossService instanceof OssService);
		assert.ok(services.modelDerivativeService instanceof ModelDerivativeService);
		assert.ok(services.designAutomationService instanceof DesignAutomationService);
		assert.ok(services.webhooksServiceApp instanceof WebhooksService);
		assert.ok(services.webhooksServiceUser instanceof WebhooksService);
		assert.ok(services.hubsService instanceof HubsService);
		assert.ok(services.secureServiceAccountsService instanceof SecureServiceAccountsService);
	});

	it('wires up every service from a plain environment plus an active user-context provider', () => {
		const services = createServices(FAKE_ENV, new StaticTokenAuthenticationProvider('fake-user-token'));
		assert.ok(services.hubsService instanceof HubsService);
		assert.ok(services.modelDerivativeService instanceof ModelDerivativeService);
		assert.ok(services.webhooksServiceUser instanceof WebhooksService);
	});

	it('uses the DA endpoint only for DA requests, keeping authentication and OSS on the APS host', async () => {
		const apsRequests: string[] = [];
		const daRequests: string[] = [];
		const aps = http.createServer((req, res) => {
			const url = req.url!.replace(/^\/+/, '/');
			apsRequests.push(url);
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(url === '/authentication/v2/token'
				? { access_token: 'fake-token', expires_in: 3600 }
				: { items: [] }));
		});
		const da = http.createServer((req, res) => {
			daRequests.push(req.url!);
			res.end('nickname');
		});
		await Promise.all([
			new Promise<void>(resolve => aps.listen(0, '127.0.0.1', resolve)),
			new Promise<void>(resolve => da.listen(0, '127.0.0.1', resolve))
		]);
		try {
			const host = `http://127.0.0.1:${(aps.address() as any).port}`;
			const endpoint = `http://127.0.0.1:${(da.address() as any).port}/custom/region/v3/`;
			const services = createServices({ ...FAKE_ENV, host, designAutomationRegion: 'us-west', designAutomationEndpoint: endpoint });

			assert.strictEqual(await services.designAutomationService.getNickname(), 'nickname');
			await services.ossService.getBucketsPage();
			assert.deepStrictEqual(daRequests, ['/custom/region/v3/forgeapps/me']);
			assert.strictEqual(apsRequests.filter(url => url === '/authentication/v2/token').length, 2, JSON.stringify(apsRequests));
			assert.ok(apsRequests.some(url => url.startsWith('/oss/v2/buckets')));
			assert.strictEqual(apsRequests.length, 3);
		} finally {
			aps.close();
			da.close();
		}
	});
});
