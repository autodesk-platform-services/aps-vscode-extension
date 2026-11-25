import * as vscode from 'vscode';
import { IContext, command, createWebViewPanel, isCancellation, showReadOnlyJson, toAbortSignal, withProgress } from '../common';
import {
    EntryType,
    ITokenFlexCategory,
    ITokenFlexContract,
    TOKEN_FLEX_QUERY_FIELDS,
    TOKEN_FLEX_QUERY_METRICS,
    TOKEN_FLEX_USAGE_CATEGORIES,
    TokenFlexUsageQuery
} from '../models/token-flex';
import type { ITokenFlexUsageChartProps } from '../webviews/token-flex-usage-chart';

export class TokenFlexCommands {
    /** Open usage chart panels by contract number, so re-running the command refreshes and reveals the existing panel. */
    private readonly chartPanels = new Map<string, vscode.WebviewPanel>();

    constructor(protected context: IContext, protected refresh: () => void) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            command(this.context, 'aps.tokenFlex.refresh', this.refreshTokenFlex.bind(this)),
            command(this.context, 'aps.tokenFlex.viewContractDetails', 'Could not retrieve contract details', this.viewContractDetails.bind(this)),
            command(this.context, 'aps.tokenFlex.copyContractNumber', this.copyContractNumber.bind(this)),
            command(this.context, 'aps.tokenFlex.viewUsageSummary', 'Could not retrieve usage summary', this.viewUsageSummary.bind(this)),
            command(this.context, 'aps.tokenFlex.viewUsageChart', 'Could not show usage chart', this.viewUsageChart.bind(this)),
            command(this.context, 'aps.tokenFlex.runUsageQuery', 'Could not run usage query', this.runUsageQuery.bind(this)),
        ];
    }

    protected ensureInput<T>(input: T | undefined): T {
        if (!input) {
            throw new Error('This command can only be triggered from the tree view.');
        }
        return input;
    }

    async refreshTokenFlex() {
        this.refresh();
    }

    async viewContractDetails(contract?: ITokenFlexContract) {
        contract = this.ensureInput(contract);
        const details = await withProgress(`Getting contract details: ${contract.contractNumber}`, this.context.tokenFlexService.getContract(contract.contractNumber));
        await showReadOnlyJson(this.context, ['token-flex', 'contracts', contract.contractNumber], details);
    }

    async copyContractNumber(contract?: ITokenFlexContract) {
        contract = this.ensureInput(contract);
        await vscode.env.clipboard.writeText(contract.contractNumber);
        vscode.window.showInformationMessage(`Contract number copied to clipboard: ${contract.contractNumber}`);
    }

    /** Shows the monthly usage summary of a contract as JSON. Triggered from a contract, its "Monthly Usage" node, or the Command Palette (prompts for the contract). */
    async viewUsageSummary(entry?: ITokenFlexContract | ITokenFlexCategory) {
        const contractNumber = entry?.contractNumber ?? await this.promptContractNumber();
        if (!contractNumber) {
            return;
        }
        const summary = await withProgress(`Getting usage summary: ${contractNumber}`, this.context.tokenFlexService.getUsageSummary(contractNumber));
        await showReadOnlyJson(this.context, ['token-flex', 'contracts', contractNumber, 'usage-summary'],
            summary.map(({ type, contractNumber, ...rest }) => rest));
    }

    /**
     * Shows the monthly usage and contract years of a contract as bar charts (rendered with Chart.js in a
     * webview). Triggered from a contract, its "Monthly Usage" node, or the Command Palette (prompts for the contract).
     */
    async viewUsageChart(entry?: ITokenFlexContract | ITokenFlexCategory) {
        const contractNumber = entry?.contractNumber ?? await this.promptContractNumber();
        if (!contractNumber) {
            return;
        }
        const service = this.context.tokenFlexService;
        const [details, summary] = await withProgress(`Getting usage data: ${contractNumber}`, Promise.all([
            service.getContract(contractNumber),
            service.getUsageSummary(contractNumber)
        ]));
        const props: ITokenFlexUsageChartProps = {
            contractNumber,
            contractName: details.contractName,
            summary: summary.map(({ type, contractNumber, ...rest }) => rest),
            contractYears: details.contractYears ?? []
        };
        const existing = this.chartPanels.get(contractNumber);
        const title = `Token Flex Usage: ${details.contractName || contractNumber}`;
        const panel = createWebViewPanel(this.context, 'token-flex-usage-chart.js', 'token-flex-usage-chart', title, props, undefined, existing ? { panel: existing } : undefined);
        if (existing) {
            existing.reveal();
        } else {
            this.chartPanels.set(contractNumber, panel);
            panel.onDidDispose(() => this.chartPanels.delete(contractNumber));
        }
    }

    /**
     * Builds an ad-hoc usage query from quick-picks (fields, metrics, usage categories, and an optional
     * `where` clause), runs it to completion, and shows the results as JSON. Triggered from a contract or
     * from the Command Palette (prompts for the contract).
     */
    async runUsageQuery(entry?: ITokenFlexContract) {
        const contractNumber = entry?.type === EntryType.Contract ? entry.contractNumber : await this.promptContractNumber();
        if (!contractNumber) {
            return;
        }
        const query = await this.promptUsageQuery();
        if (!query) {
            return;
        }
        try {
            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Running usage query: ${contractNumber}`,
                cancellable: true
            }, (progress, token) => this.context.tokenFlexService.runUsageQuery(contractNumber, query, {
                onStatus: status => progress.report({ message: status }),
                signal: toAbortSignal(token)
            }));
            const rows = result.rows.map(row => Object.fromEntries(result.columns.map((column, i) => [column, row[i]])));
            await showReadOnlyJson(this.context, ['token-flex', 'contracts', contractNumber, 'queries', result.id], { query, total: rows.length, rows });
        } catch (err) {
            if (isCancellation(err)) {
                vscode.window.showInformationMessage('Usage query monitoring cancelled');
                return;
            }
            throw err;
        }
    }

    private async promptContractNumber(): Promise<string | undefined> {
        if (!this.context.session) {
            throw new Error('The Token Flex Usage Data API requires a user context. Sign in to APS first.');
        }
        const contracts = await withProgress('Getting Token Flex contracts...', this.context.tokenFlexService.getContracts());
        if (contracts.length === 0) {
            vscode.window.showInformationMessage('No Token Flex contracts found. Contracts are only listed for Token Flex administrators.');
            return undefined;
        }
        if (contracts.length === 1) {
            return contracts[0].contractNumber;
        }
        const picked = await vscode.window.showQuickPick(
            contracts.map(contract => ({
                label: contract.contractName || contract.contractNumber,
                description: contract.contractNumber,
                detail: `${contract.contractStartDate} – ${contract.contractEndDate}${contract.isActive ? '' : ' (inactive)'}`,
                contract
            })),
            { placeHolder: 'Select a Token Flex contract', ignoreFocusOut: true, matchOnDescription: true }
        );
        return picked?.contract.contractNumber;
    }

    private async promptUsageQuery(): Promise<TokenFlexUsageQuery | undefined> {
        const fields = await vscode.window.showQuickPick(TOKEN_FLEX_QUERY_FIELDS.map(label => ({ label, picked: label === 'productName' })), {
            canPickMany: true,
            placeHolder: 'Select fields to group usage by (optional if you select metrics)',
            ignoreFocusOut: true
        });
        if (!fields) {
            return undefined;
        }
        const metrics = await vscode.window.showQuickPick(TOKEN_FLEX_QUERY_METRICS.map(label => ({ label, picked: label === 'tokensConsumed' })), {
            canPickMany: true,
            placeHolder: 'Select metrics to calculate (optional if you selected fields)',
            ignoreFocusOut: true
        });
        if (!metrics) {
            return undefined;
        }
        if (fields.length === 0 && metrics.length === 0) {
            throw new Error('A usage query needs at least one field or metric.');
        }
        const usageCategories = await vscode.window.showQuickPick(TOKEN_FLEX_USAGE_CATEGORIES.map(label => ({ label })), {
            canPickMany: true,
            placeHolder: 'Limit the query to usage categories (optional; leave empty for all)',
            ignoreFocusOut: true
        });
        if (!usageCategories) {
            return undefined;
        }
        const where = await vscode.window.showInputBox({
            prompt: 'Optional SQL-like criteria, for example: contractYear = 2 AND userName LIKE \'admin%\'',
            placeHolder: 'where clause (optional)',
            ignoreFocusOut: true
        });
        if (where === undefined) {
            return undefined;
        }
        return {
            ...(fields.length > 0 ? { fields: fields.map(item => item.label) } : {}),
            ...(metrics.length > 0 ? { metrics: metrics.map(item => item.label) } : {}),
            ...(usageCategories.length > 0 ? { usageCategory: usageCategories.map(item => item.label) } : {}),
            ...(where.trim() ? { where: where.trim() } : {})
        };
    }
}
