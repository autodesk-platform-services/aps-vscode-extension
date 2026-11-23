// @ts-ignore
const vscode = acquireVsCodeApi();

export function postMessage<T>(message: T): void {
    vscode.postMessage(message);
}

export function setState<T>(state: T): void {
    vscode.setState(state);
}