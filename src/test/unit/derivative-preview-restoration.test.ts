import * as assert from 'assert';
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

	function createCommands() {
		const context = {
			extensionContext: { extensionUri: vscode.Uri.file('/extension') },
			log: { error() {} }
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
