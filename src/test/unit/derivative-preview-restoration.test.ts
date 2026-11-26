import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ModelDerivativesCommands } from '../../commands/model-derivative';
import { IContext } from '../../common';
import type { IDerivativePreviewState } from '../../webviews/derivative-preview';

describe('derivative preview restoration', () => {
	const state: IDerivativePreviewState = {
		version: 1,
		environment: { title: '東京', clientId: 'client', region: 'EMEA' },
		urn: 'model-urn',
		guid: 'view-guid',
		api: 'streamingV2_EU',
		env: 'AutodeskProduction2',
		extensions: ['Example.Extension']
	};

	function createPanel() {
		const messages: ((message: any) => void)[] = [];
		const panel = {
			title: 'Preview: model',
			onDidDispose: () => ({ dispose() {} }),
			webview: {
				cspSource: 'https://webview.example',
				html: '',
				options: {} as vscode.WebviewOptions,
				asWebviewUri: (uri: vscode.Uri) => uri,
				onDidReceiveMessage: (handler: (message: any) => void) => {
					messages.push(handler);
					return { dispose() {} };
				}
			}
		};
		return { panel, messages };
	}

	function createCommands(scripts: string[] = []) {
		const context = {
			extensionContext: { extensionUri: vscode.Uri.file('/extension') },
			previewSettings: { extensions: [], scripts },
			log: { error() {}, warn() {} }
		} as unknown as IContext;
		return new ModelDerivativesCommands(context, () => {});
	}

	it('reuses the panel with a fresh token and only non-secret persisted state', async () => {
		const { panel, messages } = createPanel();
		let requested: IDerivativePreviewState | undefined;
		await createCommands().restoreDerivativePreview(panel as unknown as vscode.WebviewPanel, { ...state, token: 'old-token' }, async saved => {
			requested = saved;
			return 'fresh-token';
		});
		assert.deepStrictEqual(requested, { ...state, environment: { ...state.environment, host: undefined } });
		const encoded = panel.webview.html.match(/atob\('([^']+)'\)/)?.[1];
		assert.ok(encoded);
		const props = JSON.parse(Buffer.from(encoded, 'base64').toString());
		assert.strictEqual(props.token, 'fresh-token');
		assert.strictEqual(props.state.token, undefined);
		assert.strictEqual(props.state.environment.title, '東京');
		assert.strictEqual(props.state.urn, state.urn);
		assert.strictEqual(props.state.guid, state.guid);
		assert.deepStrictEqual(props.config.extensions, state.extensions);
		assert.strictEqual(panel.webview.options.enableScripts, true);
		assert.strictEqual(messages.length, 1);
	});

	let scriptsDir: string;
	before(() => {
		scriptsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aps-viewer-scripts-'));
		fs.writeFileSync(path.join(scriptsDir, 'my-extension.js'), '// test');
	});
	after(() => fs.rmSync(scriptsDir, { recursive: true, force: true }));

	it('injects the configured viewer scripts and allows their origins', async () => {
		const { panel } = createPanel();
		const local = vscode.Uri.file(path.join(scriptsDir, 'my-extension.js'));
		await createCommands([local.fsPath, 'https://cdn.example.com/lib/ext.js', 'http://insecure.example.com/ext.js'])
			.restoreDerivativePreview(panel as unknown as vscode.WebviewPanel, state, async () => 'token');
		const html = panel.webview.html;
		assert.ok(html.includes(`src="${local.toString()}"`));
		assert.ok(html.includes('src="https://cdn.example.com/lib/ext.js"'));
		assert.ok(!html.includes('insecure.example.com'));
		assert.match(html, /script-src [^;]*https:\/\/cdn\.example\.com[ ;']/);
		assert.ok(html.indexOf('viewer3D.js') < html.indexOf('my-extension.js'));
		const roots = (panel.webview.options.localResourceRoots ?? []).map(uri => uri.fsPath);
		assert.ok(roots.includes(vscode.Uri.file(scriptsDir).fsPath));
	});

	it('skips local viewer scripts that do not exist', async () => {
		const { panel } = createPanel();
		const missing = path.join(scriptsDir, 'missing', 'gone.js');
		await createCommands([missing]).restoreDerivativePreview(panel as unknown as vscode.WebviewPanel, state, async () => 'token');
		const html = panel.webview.html;
		assert.ok(html.includes('viewer3D.js'));
		assert.ok(!html.includes('gone.js'));
		const roots = (panel.webview.options.localResourceRoots ?? []).map(uri => uri.fsPath);
		assert.ok(!roots.includes(vscode.Uri.file(path.dirname(missing)).fsPath));
	});

	it('reports invalid state without requesting a token', async () => {
		const { panel } = createPanel();
		let requested = false;
		await createCommands().restoreDerivativePreview(panel as unknown as vscode.WebviewPanel, { ...state, urn: null }, async () => {
			requested = true;
			return 'token';
		});
		assert.strictEqual(requested, false);
		assert.match(panel.webview.html, /Could not restore the viewer/);
	});

	it('shows a recovery message when token retrieval fails', async () => {
		const { panel } = createPanel();
		await createCommands().restoreDerivativePreview(panel as unknown as vscode.WebviewPanel, state, async () => {
			throw new Error('Unavailable');
		});
		assert.match(panel.webview.html, /reopen it from the tree view/);
	});
});
