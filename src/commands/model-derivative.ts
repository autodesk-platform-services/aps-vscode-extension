import * as vscode from 'vscode';
import * as path from 'path';
import { ObjectDetails } from '../models/oss';
import { ObjectTree, Properties, IDerivative, svf2 } from '../models/model-derivative';
import { IContext, command, promptBucket, promptCustomDerivative, promptDerivative, promptObject, showErrorMessage } from '../common';
import { withProgress, createWebViewPanel, showReadOnlyJson } from '../common';
import type { IDerivativePreviewProps, IDerivativePreviewMessage, IDerivativePreviewState } from '../webviews/derivative-preview';
import type { IThumbnailsProps, IThumbnailsMessage } from '../webviews/thumbnails';
import type { ICustomDerivativeMessage, ICustomDerivativeProps } from '../webviews/custom-translation';
import { IVersion } from '../models/hubs';

export class ModelDerivativesCommands {
	constructor(protected context: IContext, protected refresh: () => void) {
	}

	registerCommands(): vscode.Disposable[] {
		return [
			command(this.context, 'aps.md.translateObject', this.translateObject.bind(this)),
			command(this.context, 'aps.md.translateObjectCustom', 'Could not translate object', this.translateObjectCustom.bind(this)),
			command(this.context, 'aps.md.listViewables', 'Could not retrieve viewables', this.listViewables.bind(this)),
			command(this.context, 'aps.md.previewDerivative', this.previewDerivative.bind(this)),
			command(this.context, 'aps.md.viewDerivativeTree', 'Could not access derivative tree', this.viewDerivativeTree.bind(this)),
			command(this.context, 'aps.md.viewDerivativeProps', 'Could not access derivative properties', this.viewDerivativeProps.bind(this)),
			command(this.context, 'aps.md.viewObjectManifest', 'Could not access object manifest', this.viewObjectManifest.bind(this)),
			command(this.context, 'aps.md.viewObjectThumbnail', 'Could not access derivative thumbnails', this.viewObjectThumbnail.bind(this)),
			command(this.context, 'aps.md.deleteObjectManifest', this.deleteObjectManifest.bind(this)),
			command(this.context, 'aps.md.downloadDerivativeCustom', this.downloadDerivativeCustom.bind(this)),
			command(this.context, 'aps.md.copyObjectUrn', 'Could not obtain object URN', this.copyObjectUrn.bind(this)),
		];
	}

	async translateObject(object?: ObjectDetails | IVersion) {
		try {
			if (!object) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				object = await promptObject(this.context, bucket.bucketKey);
				if (!object) {
					return;
				}
			}

			const availableFormats = await withProgress('Retrieving supported output formats', this.context.modelDerivativeService.getSupportedOutputFormats(object));
			if (!availableFormats.find(x => x === svf2)) {
				showErrorMessage("The conversion to SVF2 is not supported for this file by Model derivative service", {});
				return;
			}

			await withProgress('Starting translation...', this.context.modelDerivativeService.translateToSvf2(object));
			vscode.window.showInformationMessage(`Translation started. Expand the object in the tree to see details.`);
		} catch (err) {
			showErrorMessage('Could not translate object', err, this.context);
		}
		this.refresh();
	}

	async translateObjectCustom(object?: ObjectDetails | IVersion) {
		if (!object) {
			const bucket = await promptBucket(this.context);
			if (!bucket) {
				return;
			}
			object = await promptObject(this.context, bucket.bucketKey);
			if (!object) {
				return;
			}
		}

		const urn = this.context.modelDerivativeService.getObjectUrn(object);
		const availableFormats = await withProgress('Retrieving supported output formats', this.context.modelDerivativeService.getSupportedOutputFormats(object));
		if (availableFormats.length === 0) {
			showErrorMessage("Source file format is not supported by Model derivative service", {});
			return;
		}
		const sourceFormat = this.context.modelDerivativeService.getSourceFileFormat(object);

		const translateObject = object;
		let panel = createWebViewPanel<ICustomDerivativeProps, ICustomDerivativeMessage>(this.context, 'custom-translation.js', 'custom-translation', `Custom Translation: ${urn}`, { urn, availableFormats, sourceFormat }, async (message: ICustomDerivativeMessage) => {
			switch (message.type) {
				case 'translate':
					try {
						await withProgress('Starting translation...', this.context.modelDerivativeService.startCustomTranslation(translateObject, message.data));
						vscode.window.showInformationMessage(`Translation started. Expand the object in the tree to see details.`);
					} catch (err: any) {
						if (err.response && err.response.statusCode === 406) {
							showErrorMessage('Could not translate object, likely because its derivatives exist in a different region. Please, delete the derivatives manually before translating the object again.', null);
						} else {
							showErrorMessage('Could not translate object', err, this.context);
						}
					}
					panel.dispose();
					this.refresh();
					break;
			}
		});
	}

	async listViewables(object?: ObjectDetails | IVersion) {
		if (!object) {
			const bucket = await promptBucket(this.context);
			if (!bucket) {
				return;
			}
			object = await promptObject(this.context, bucket.bucketKey);
			if (!object) {
				return;
			}
		}
		const metadata = await withProgress(`Retrieving list of viewables`, this.context.modelDerivativeService.getModelViews(object));
		const urn = this.context.modelDerivativeService.getObjectUrn(object);
		await showReadOnlyJson(this.context, ['model-derivative', 'viewables', urn], metadata);
	}

	async previewDerivative(derivative?: IDerivative) {
		try {
			if (!derivative) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				const object = await promptObject(this.context, bucket.bucketKey);
				if (!object) {
					return;
				}
				derivative = await promptDerivative(this.context, object.objectId!);
				if (!derivative) {
					return;
				}
			}
			const environment = this.context.environment;
			const service = this.context.modelDerivativeService;
			let env = this.context.previewSettings.env;
			if (!env) {
				env = derivative.format === svf2 ? 'AutodeskProduction2' : 'AutodeskProduction';
			}
			let api = this.context.previewSettings.api;
			if (!api) {
				api = derivative.format === svf2 ? 'streamingV2' : 'derivativeV2';
				if (environment.region === 'EMEA') {
					api += '_EU';
				}
				// TODO: what about 'APAC'?
			}
			const state: IDerivativePreviewState = {
				version: 1,
				environment: { title: environment.title, clientId: environment.clientId, host: environment.host, region: environment.region },
				urn: derivative.urn,
				guid: derivative.guid,
				api, env,
				extensions: this.context.previewSettings.extensions
			};
			const accessToken = await withProgress('Retrieving viewer access token', service.getViewerAccessToken(derivative.urn));
			this.showDerivativePreview(`Preview: ${derivative.name}`, state, accessToken);
		} catch (err) {
			showErrorMessage(`Could not access object`, err, this.context);
		}
	}

	showDerivativePreview(title: string, state: IDerivativePreviewState, token: string, panel?: vscode.WebviewPanel) {
		createWebViewPanel<IDerivativePreviewProps, IDerivativePreviewMessage>(this.context, 'derivative-preview.js', 'derivative-preview', title, {
			api: state.api, env: state.env, token, urn: state.urn, guid: state.guid,
			config: { extensions: state.extensions }, state
		}, message => {
				switch (message.type) {
					case 'error':
						showErrorMessage(`Could not load viewable`, message.error, this.context);
						break;
				}
		}, { viewer: true, panel });
	}

	async restoreDerivativePreview(panel: vscode.WebviewPanel, state: unknown, getToken: (state: IDerivativePreviewState) => Promise<string>) {
		try {
			if (!isDerivativePreviewState(state)) {
				throw new Error('The saved viewer state is invalid.');
			}
			const safeState: IDerivativePreviewState = {
				version: 1,
				environment: {
					title: state.environment.title, clientId: state.environment.clientId,
					host: state.environment.host, region: state.environment.region
				},
				urn: state.urn, guid: state.guid, api: state.api, env: state.env, extensions: state.extensions
			};
			const token = await getToken(safeState);
			this.showDerivativePreview(panel.title, safeState, token, panel);
		} catch (err) {
			panel.webview.html = '<!DOCTYPE html><html><body>Could not restore the viewer. Please reopen it from the tree view.</body></html>';
			showErrorMessage('Could not restore viewer', err, this.context);
		}
	}

	async viewDerivativeTree(derivative?: IDerivative) {
		if (!derivative) {
			const bucket = await promptBucket(this.context);
			if (!bucket) {
				return;
			}

			const object = await promptObject(this.context, bucket.bucketKey);
			if (!object) {
				return;
			}
			derivative = await promptDerivative(this.context, object.objectId!);
			if (!derivative) {
				return;
			}
		}
		const viewable = findViewable(derivative);
		const { urn } = derivative;
		const { guid } = viewable;
		let forceDownload = false;
		let tree: ObjectTree | undefined = undefined;
		try {
			tree = await withProgress(`Retrieving viewable tree`, this.context.modelDerivativeService.getObjectTree(urn, guid));
		} catch (err: any) {
			// APS may respond with code 413 to indicate that the requested JSON data is too large.
			// In that case, offer an option of downloading the content to a local file.
			if (err.isAxiosError && err.response.status === 413) {
				const action = await vscode.window.showInformationMessage(`
					Cannot obtain viewable tree, possibly because the content is too large.
					Would you like to try and force-download the tree JSON?
				`, 'Force Download', 'Cancel');
				switch (action) {
					case 'Force Download':
						// TODO: redirect the downloaded data directly into a file stream
						tree = await withProgress(`Downloading viewable tree`, this.context.modelDerivativeService.getObjectTree(urn, guid, true));
						forceDownload = true;
						break;
					case 'Cancel':
						break;
				}
			} else {
				throw err;
			}
		}
		if (forceDownload) {
			const defaultPath = vscode.workspace.asRelativePath('tree.json');
			const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(defaultPath) });
			if (uri) {
				await this.context.modelDerivativeService.saveToFile(uri.fsPath, JSON.stringify(tree, null, 4));
				const action = await vscode.window.showInformationMessage(`Tree downloaded to ${uri.fsPath}.`, 'Open Folder');
				if (action === 'Open Folder') {
					vscode.env.openExternal(vscode.Uri.file(path.dirname(uri.fsPath)));
				}
			}
		} else {
			await showReadOnlyJson(this.context, ['model-derivative', 'tree', urn, guid], tree);
		}
	}

	async viewDerivativeProps(derivative?: IDerivative) {
		if (!derivative) {
			const bucket = await promptBucket(this.context);
			if (!bucket) {
				return;
			}
			const object = await promptObject(this.context, bucket.bucketKey);
			if (!object) {
				return;
			}
			derivative = await promptDerivative(this.context, object.objectId!);
			if (!derivative) {
				return;
			}
		}
		const viewable = findViewable(derivative);
		const { urn } = derivative;
		const { guid } = viewable;
		let forceDownload = false;
		let props: Properties | undefined = undefined;
		try {
			props = await withProgress(`Retrieving viewable properties`, this.context.modelDerivativeService.getAllProperties(urn, guid));
		} catch (err: any) {
			// APS may respond with code 413 to indicate that the requested JSON data is too large.
			// In that case, offer an option of downloading the content to a local file.
			if (err.isAxiosError && err.response.status === 413) {
				const action = await vscode.window.showInformationMessage(`
					Cannot obtain viewable properties, possibly because the content is too large.
					Would you like to try and force-download the property JSON?
				`, 'Force Download', 'Cancel');
				switch (action) {
					case 'Force Download':
						// TODO: redirect the downloaded data directly into a file stream
						props = await withProgress(`Downloading viewable properties`, this.context.modelDerivativeService.getAllProperties(urn, guid, true));
						forceDownload = true;
						break;
					case 'Cancel':
						break;
				}
			} else {
				throw err;
			}
		}
		if (forceDownload) {
			const defaultPath = vscode.workspace.asRelativePath('properties.json');
			const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(defaultPath) });
			if (uri) {
				await this.context.modelDerivativeService.saveToFile(uri.fsPath, JSON.stringify(props, null, 4));
				const action = await vscode.window.showInformationMessage(`Properties downloaded to ${uri.fsPath}.`, 'Open Folder');
				if (action === 'Open Folder') {
					vscode.env.openExternal(vscode.Uri.file(path.dirname(uri.fsPath)));
				}
			}
		} else {
			await showReadOnlyJson(this.context, ['model-derivative', 'properties', urn, guid], props);
		}
	}

	async viewObjectManifest(object?: ObjectDetails | IVersion) {
		if (!object) {
			const bucket = await promptBucket(this.context);
			if (!bucket) {
				return;
			}
			object = await promptObject(this.context, bucket.bucketKey);
			if (!object) {
				return;
			}
		}

		const urn = this.context.modelDerivativeService.getObjectUrn(object);
		const manifest = await withProgress(`Retrieving manifest for ${urn}`, this.context.modelDerivativeService.getObjectManifest(object));
		await showReadOnlyJson(this.context, ['model-derivative', 'manifest', urn], manifest);
	}

	async viewObjectThumbnail(object?: ObjectDetails | IVersion) {
		const downloadThumbnail = async (png: Uint8Array, defaultUri: vscode.Uri) => {
			const uri = await vscode.window.showSaveDialog({ defaultUri });
			if (!uri) {
				return;
			}
			await this.context.modelDerivativeService.saveToFile(uri.fsPath, png);
			vscode.window.showInformationMessage(`Thumbnail downloaded: ${uri.fsPath}`);
		};

		if (!object) {
			const bucket = await promptBucket(this.context);
			if (!bucket) {
				return;
			}
			object = await promptObject(this.context, bucket.bucketKey);
			if (!object) {
				return;
			}
		}

		const thumbnailObject = object;
		const key = getKey(object);
		const id = getId(object);

		try {
			const thumbnails = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Downloading thumbnails: ${key}`,
				cancellable: false
			}, async () => {
				await this.context.modelDerivativeService.getObjectManifest(thumbnailObject); // Check if the manifest exists
				return await this.context.modelDerivativeService.getObjectThumbnails(thumbnailObject);
			});
			const pngToDataURI = (img: Buffer) => 'data:image/png;base64,' + img.toString('base64');
			createWebViewPanel<IThumbnailsProps, IThumbnailsMessage>(this.context, 'thumbnails.js', 'thumbnails', `Thumbnails: ${key}`, {
				objectKey: key,
				smallDataURI: pngToDataURI(thumbnails[0]),
				mediumDataURI: pngToDataURI(thumbnails[1]),
				largeDataURI: pngToDataURI(thumbnails[2])
			}, message => {
				switch (message.command) {
					case 'download':
						switch (message.thumbnailSize) {
							case 'small':
								downloadThumbnail(thumbnails[0], vscode.Uri.file(key + '.100x100.png'));
								break;
							case 'medium':
								downloadThumbnail(thumbnails[1], vscode.Uri.file(key + '.200x200.png'));
								break;
							case 'large':
								downloadThumbnail(thumbnails[2], vscode.Uri.file(key + '.400x400.png'));
								break;
						}
				}
			});
		} catch (_) {
			const action = await vscode.window.showInformationMessage(`
				In order to access the thumbnails of ${id}, the object must be translated first.
				Would you like to start the translation now?
			`, TranslationActions.Translate, TranslationActions.TranslateAsArchive);
			switch (action) {
				case TranslationActions.Translate:
					await this.translateObject(object);
					break;
				case TranslationActions.TranslateAsArchive:
					await this.translateObject(object);
					break;
			}
		}
	}

	async deleteObjectManifest(object?: ObjectDetails) {
		try {
			if (!object) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				object = await promptObject(this.context, bucket.bucketKey);
				if (!object) {
					return;
				}
			}

			const urn = this.context.modelDerivativeService.getObjectUrn(object);

			const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete manifest for ${urn}? This action cannot be undone.`, { modal: true }, 'Delete');
			if (confirm !== 'Delete') {
				return;
			}

			try {
				await withProgress(`Deleting manifest for ${urn}`, this.context.modelDerivativeService.deleteManifest(object));
			} catch (_) {
				const action = await vscode.window.showInformationMessage(`
					In order to access the manifest of ${object.objectId}, the object must be translated first.
					Would you like to start the translation now?
				`, TranslationActions.Translate, TranslationActions.TranslateAsArchive);
				switch (action) {
					case TranslationActions.Translate:
						await this.translateObject(object);
						break;
					case TranslationActions.TranslateAsArchive:
						await this.translateObject(object);
						break;
				}
			}
			vscode.window.showInformationMessage(`Derivatives deleted: ${object.objectKey}`);
		} catch (err) {
			showErrorMessage('Could not delete derivatives', err, this.context);
		}
		this.refresh();
	}

	async downloadDerivativeCustom(object?: IDerivative) {
		try {
			if (!object) {
				const bucket = await promptBucket(this.context);
				if (!bucket) {
					return;
				}
				const bucketObject = await promptObject(this.context, bucket.bucketKey);
				if (!bucketObject) {
					return;
				}

				object = await promptCustomDerivative(this.context, bucketObject.objectId!);

				if (!object) {
					return;
				}
			}

			const outputFolderUri = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false });
			if (!outputFolderUri) {
				return;
			}

			const baseDir = outputFolderUri[0].fsPath;
			const targetFileName = path.join(baseDir, object.name);

			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Downloading the derivative: ${object.name}`,
				cancellable: false
			}, async () => {
				const bytes = await this.context.modelDerivativeService.downloadDerivative(object!.bubble.fileUrn, object!.urn);
				await this.context.modelDerivativeService.saveToFile(targetFileName, bytes);
			});

			const action = await vscode.window.showInformationMessage('Derivative downloaded successfully', 'Open Folder');
			if (action === 'Open Folder') {
				vscode.env.openExternal(vscode.Uri.file(baseDir));
			}
		} catch (err) {
			showErrorMessage(`Could not download the derivative`, err, this.context);
		}
	}

	async copyObjectUrn(object?: ObjectDetails | IVersion) {
		if (!object) {
			const bucket = await promptBucket(this.context);
			if (!bucket) {
				return;
			}
			object = await promptObject(this.context, bucket.bucketKey);
			if (!object) {
				return;
			}
		}

		const urn = this.context.modelDerivativeService.getObjectUrn(object);
		await vscode.env.clipboard.writeText(urn);
		vscode.window.showInformationMessage(`Object URN copied to clipboard: ${urn}`);
	}
}

function isDerivativePreviewState(value: unknown): value is IDerivativePreviewState {
	const state = value as IDerivativePreviewState | null;
	return !!state && state.version === 1 && !!state.environment
		&& typeof state.environment.title === 'string' && typeof state.environment.clientId === 'string'
		&& (state.environment.host === undefined || typeof state.environment.host === 'string')
		&& (state.environment.region === undefined || typeof state.environment.region === 'string')
		&& typeof state.urn === 'string' && state.urn.length > 0
		&& (state.guid === undefined || typeof state.guid === 'string')
		&& typeof state.api === 'string' && typeof state.env === 'string'
		&& Array.isArray(state.extensions) && state.extensions.every(extension => typeof extension === 'string');
}

enum TranslationActions {
	Translate = 'Translate',
	TranslateAsArchive = 'Translate as Archive'
}

function getKey(object: ObjectDetails | IVersion): string {
	if ('objectId' in object) { //IObject
		return object.objectKey!;
	} else if ('itemId' in object) { //IVersion
		return object.itemId;
	}
	return '';
}

function getId(object: ObjectDetails | IVersion): string {
	if ('objectId' in object) { //IObject
		return object.objectId!;
	} else if ('itemId' in object) { //IVersion
		return object.id;
	}
	return '';
}

function findViewable(derivative: IDerivative): any {
	return derivative.bubble.children.find((child: any) => child.role === 'graphics' || child.role === 'pdf-page');
}
