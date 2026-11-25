// @ts-nocheck
import { postMessage, setState } from './common';

export interface IDerivativePreviewState {
    version: 1;
    environment: { title: string; clientId: string; host?: string; region?: string };
    urn: string;
    guid?: string;
    api: string;
    env: string;
    extensions: string[];
}

export type IDerivativePreviewMessage = {
    type: 'error';
    error: { code: string; message: string; errors?: any; };
};

export interface IDerivativePreviewProps {
    api: string;
    env: string;
    token: string;
    urn: string;
    guid?: string;
    config?: any;
    state: IDerivativePreviewState;
}

export function render(container: HTMLElement, props: IDerivativePreviewProps) {
    const { api, env, token, urn, guid, config } = props;
    setState(props.state);
    Autodesk.Viewing.Initializer({ api, env, accessToken: token }, function () {
        const viewer = new Autodesk.Viewing.GuiViewer3D(container, config);
        viewer.start();
        Autodesk.Viewing.Document.load(
            'urn:' + urn,
            doc => viewer.loadDocumentNode(doc, guid ? doc.getRoot().findByGuid(guid) : doc.getRoot().getDefaultGeometry()),
            (code, message, errors) => postMessage({ type: 'error', error: { code, message, errors } }));
    });
}