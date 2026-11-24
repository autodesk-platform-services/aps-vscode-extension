import * as vscode from 'vscode';
import { BaseTreeProvider } from './base';
import { IContext } from '../common';
import { IHint } from '../models/hubs';
import {
    EntryType,
    ITokenFlexCategory,
    ITokenFlexContract,
    ITokenFlexContractYear,
    ITokenFlexLastUpdated,
    ITokenFlexUsageSummary
} from '../models/token-flex';

type TokenFlexEntry =
    | ITokenFlexContract
    | ITokenFlexCategory
    | ITokenFlexContractYear
    | ITokenFlexUsageSummary
    | ITokenFlexLastUpdated
    | IHint;

function isHint(entry: TokenFlexEntry): entry is IHint {
    return (<IHint>entry).hint !== undefined;
}

const numberFormat = new Intl.NumberFormat();

/** Formats a token count with thousands separators, e.g. "146,226". */
export function formatTokens(value: number | undefined | null): string {
    return value === undefined || value === null ? '?' : numberFormat.format(value);
}

/** Formats a `YYYY-MM-DD` usage month as `YYYY-MM`. */
function formatMonth(usageMonth: string): string {
    return usageMonth.length >= 7 ? usageMonth.substring(0, 7) : usageMonth;
}

const CATEGORY_LABELS: Record<ITokenFlexCategory['type'], { label: string; icon: string; id: string }> = {
    [EntryType.ContractYearsCategory]: { label: 'Contract Years', icon: 'calendar', id: 'years' },
    [EntryType.UsageSummaryCategory]: { label: 'Monthly Usage', icon: 'graph', id: 'usage' },
    [EntryType.LastUpdatedCategory]: { label: 'Last Updated', icon: 'history', id: 'last' }
};

/** Tree view over the Token Flex Usage Data API: contracts of the signed-in Token Flex administrator, their contract years, monthly usage, and data freshness. */
export class TokenFlexDataProvider extends BaseTreeProvider<TokenFlexEntry> {

    constructor(private readonly _context: IContext) {
        super();
    }

    getTreeItem(entry: TokenFlexEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (isHint(entry)) {
            const node = new vscode.TreeItem('', vscode.TreeItemCollapsibleState.None);
            node.description = entry.hint;
            node.tooltip = entry.tooltip;
            node.contextValue = 'hint';
            return node;
        }
        switch (entry.type) {
            case EntryType.Contract: {
                const node = new vscode.TreeItem(entry.contractName || entry.contractNumber, vscode.TreeItemCollapsibleState.Collapsed);
                node.id = `token-flex-${entry.contractNumber}`;
                node.description = `${entry.contractNumber}${entry.isActive ? '' : ' (inactive)'}`;
                node.tooltip = [
                    `Contract`,
                    `Number: ${entry.contractNumber}`,
                    `Name: ${entry.contractName}`,
                    `Start: ${entry.contractStartDate}`,
                    `End: ${entry.contractEndDate}`,
                    `Active: ${entry.isActive ? 'yes' : 'no'}`
                ].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon(entry.isActive ? 'file-certificate' : 'circle-slash');
                return node;
            }
            case EntryType.ContractYearsCategory:
            case EntryType.UsageSummaryCategory:
            case EntryType.LastUpdatedCategory: {
                const { label, icon, id } = CATEGORY_LABELS[entry.type];
                const node = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
                node.id = `token-flex-${entry.contractNumber}-${id}`;
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon(icon);
                return node;
            }
            case EntryType.ContractYear: {
                const node = new vscode.TreeItem(`Year ${entry.year}`, vscode.TreeItemCollapsibleState.None);
                node.id = `token-flex-${entry.contractNumber}-year-${entry.year}`;
                node.description = `${formatTokens(entry.consumedTokens)}/${formatTokens(entry.provisionedTokens)} tokens consumed`;
                node.tooltip = [
                    `Contract Year ${entry.year}`,
                    `Start: ${entry.startDate}`,
                    `End: ${entry.endDate}`,
                    `Provisioned tokens: ${formatTokens(entry.provisionedTokens)}`,
                    `Consumed tokens: ${formatTokens(entry.consumedTokens)}`,
                    `Remaining tokens: ${formatTokens(entry.remainingTokens)}`,
                    `Multi-year tokens at start: ${formatTokens(entry.multiyearTokensAtStart)}`,
                    `Multi-year tokens consumed: ${formatTokens(entry.multiyearConsumedTokens)}`
                ].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('calendar');
                return node;
            }
            case EntryType.UsageSummary: {
                const node = new vscode.TreeItem(`${formatMonth(entry.usageMonth)} ${entry.usageCategory}`, vscode.TreeItemCollapsibleState.None);
                node.id = `token-flex-${entry.contractNumber}-usage-${entry.usageMonth}-${entry.usageCategory}`;
                node.description = `${formatTokens(entry.tokensConsumed)} tokens, ${formatTokens(entry.uniqueUsers)} users`;
                node.tooltip = [
                    `Monthly Usage`,
                    `Month: ${formatMonth(entry.usageMonth)}`,
                    `Contract year: ${entry.contractYear}`,
                    `Usage category: ${entry.usageCategory}`,
                    `Tokens consumed: ${formatTokens(entry.tokensConsumed)}`,
                    `Unique users: ${formatTokens(entry.uniqueUsers)}`
                ].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('pulse');
                return node;
            }
            case EntryType.LastUpdated: {
                const node = new vscode.TreeItem(`${entry.usageCategory} (${entry.chargeCategory})`, vscode.TreeItemCollapsibleState.None);
                node.id = `token-flex-${entry.contractNumber}-last-${entry.usageCategory}-${entry.chargeCategory}`;
                node.description = entry.lastUsageDate;
                node.tooltip = [
                    `Last Updated`,
                    `Usage category: ${entry.usageCategory}`,
                    `Charge category: ${entry.chargeCategory}`,
                    `Last usage date: ${entry.lastUsageDate}`,
                    `Last processed: ${entry.lastProcessDate}`
                ].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('clock');
                return node;
            }
        }
    }

    async getChildren(entry?: TokenFlexEntry): Promise<TokenFlexEntry[]> {
        if (!entry) {
            return this.getRoots();
        }
        if (isHint(entry)) {
            return [];
        }
        const service = this._context.tokenFlexService;
        switch (entry.type) {
            case EntryType.Contract:
                return [
                    { type: EntryType.ContractYearsCategory, contractNumber: entry.contractNumber },
                    { type: EntryType.UsageSummaryCategory, contractNumber: entry.contractNumber },
                    { type: EntryType.LastUpdatedCategory, contractNumber: entry.contractNumber }
                ];
            case EntryType.ContractYearsCategory:
                return this.load('contract years', () => service.getContractYears(entry.contractNumber));
            case EntryType.UsageSummaryCategory:
                return this.load('usage', () => service.getUsageSummary(entry.contractNumber));
            case EntryType.LastUpdatedCategory:
                return this.load('last updated dates', () => service.getLastUpdated(entry.contractNumber));
            default:
                return [];
        }
    }

    private async getRoots(): Promise<TokenFlexEntry[]> {
        // No session -> return nothing so the welcome view is shown instead.
        if (!this._context.session) {
            return [];
        }
        try {
            const contracts = await this._context.tokenFlexService.getContracts();
            return contracts.length > 0
                ? contracts
                : [{ hint: 'No contracts found.', tooltip: 'Token Flex contracts are only listed for users who are Token Flex administrators.' }];
        } catch (err: any) {
            return this.toErrorHint('contracts', err);
        }
    }

    private async load(what: string, fetch: () => Promise<TokenFlexEntry[]>): Promise<TokenFlexEntry[]> {
        try {
            const entries = await fetch();
            return entries.length > 0 ? entries : [{ hint: `No ${what} found.`, tooltip: '' }];
        } catch (err: any) {
            return this.toErrorHint(what, err);
        }
    }

    private toErrorHint(what: string, err: any): IHint[] {
        this._context.log.error(`Could not retrieve ${what}`);
        this._context.log.error(err);
        const status = err?.response?.status;
        const tooltip = status === 401 || status === 403
            ? 'Make sure you are signed in as a Token Flex administrator, with the data:read scope.'
            : `An error occurred while retrieving data from the Token Flex Usage Data API: ${err?.message ?? err}`;
        return [{ hint: `Could not retrieve ${what}.`, tooltip }];
    }
}
