import * as vscode from 'vscode';
import { BaseTreeProvider } from './base';
import { IContext } from '../common';
import { IHint } from '../models/hubs';
import {
    EntryType,
    IBspReportingCategory,
    IBspReportingDownload,
    IBspReportingExport,
    IBspReportingTeam
} from '../models/bsp-reporting';

type BspReportingEntry =
    | IBspReportingCategory
    | IBspReportingTeam
    | IBspReportingExport
    | IBspReportingDownload
    | IHint;

function isHint(entry: BspReportingEntry): entry is IHint {
    return (<IHint>entry).hint !== undefined;
}

const EXPORT_STATUS_ICONS: Record<string, string> = {
    SUBMITTED: 'loading~spin',
    COMPLETED: 'pass',
    EXPIRED: 'history',
    ERROR: 'error'
};

/** Formats an ISO timestamp as `YYYY-MM-DD HH:MM` (UTC). */
function formatTimestamp(timestamp: string | undefined): string {
    return timestamp ? timestamp.replace('T', ' ').substring(0, 16) : '?';
}

/** Tree view over the Business Success Plan Reporting API: the teams the signed-in admin can report on, and their recent usage exports. */
export class BspReportingDataProvider extends BaseTreeProvider<BspReportingEntry> {

    constructor(private readonly _context: IContext) {
        super();
    }

    getTreeItem(entry: BspReportingEntry): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (isHint(entry)) {
            const node = new vscode.TreeItem('', vscode.TreeItemCollapsibleState.None);
            node.description = entry.hint;
            node.tooltip = entry.tooltip;
            node.contextValue = 'hint';
            return node;
        }
        switch (entry.type) {
            case EntryType.TeamsCategory: {
                const node = new vscode.TreeItem('Teams', vscode.TreeItemCollapsibleState.Expanded);
                node.id = 'bsp-reporting-teams';
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('organization');
                return node;
            }
            case EntryType.ExportsCategory: {
                const node = new vscode.TreeItem('Exports', vscode.TreeItemCollapsibleState.Collapsed);
                node.id = 'bsp-reporting-exports';
                node.tooltip = 'Export requests of the last two weeks (older ones are deleted)';
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('export');
                return node;
            }
            case EntryType.Team: {
                const node = new vscode.TreeItem(entry.alias || entry.contextId, vscode.TreeItemCollapsibleState.None);
                node.id = `bsp-reporting-team-${entry.contextId}`;
                node.description = entry.contextId;
                node.tooltip = [
                    `Team`,
                    `ID: ${entry.contextId}`,
                    `Name: ${entry.alias}`,
                    `Reporting benefits: ${entry.reportingBenefits?.length ? entry.reportingBenefits.join(', ') : 'none'}`
                ].join('\n');
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('account');
                return node;
            }
            case EntryType.Export: {
                const hasDownloads = entry.status === 'COMPLETED' && entry.downloads?.length > 0;
                const node = new vscode.TreeItem((entry.reports ?? []).join(', ') || entry.id,
                    hasDownloads ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
                node.id = `bsp-reporting-export-${entry.id}`;
                node.description = `${formatTimestamp(entry.timestamp)} ${entry.outputFormat} ${entry.teamName ?? 'all teams'}`;
                node.tooltip = [
                    `Export`,
                    `ID: ${entry.id}`,
                    `Created: ${entry.timestamp}`,
                    `Status: ${entry.status}`,
                    `Format: ${entry.outputFormat}`,
                    `Reports: ${(entry.reports ?? []).join(', ')}`,
                    `Team: ${entry.teamName ? `${entry.teamName} (${entry.teamId})` : 'all teams'}`
                ].join('\n');
                node.contextValue = entry.status === 'COMPLETED' ? `${entry.type}-completed` : entry.type;
                node.iconPath = new vscode.ThemeIcon(EXPORT_STATUS_ICONS[entry.status] ?? 'file');
                return node;
            }
            case EntryType.Download: {
                const node = new vscode.TreeItem(entry.reportType, vscode.TreeItemCollapsibleState.None);
                node.id = `bsp-reporting-export-${entry.exportId}-${entry.reportType}`;
                node.description = entry.outputFormat;
                node.tooltip = `Download ${entry.reportType} (${entry.outputFormat})`;
                node.contextValue = entry.type;
                node.iconPath = new vscode.ThemeIcon('file');
                return node;
            }
        }
    }

    async getChildren(entry?: BspReportingEntry): Promise<BspReportingEntry[]> {
        if (!entry) {
            // No session -> return nothing so the welcome view is shown instead.
            return this._context.session
                ? [{ type: EntryType.TeamsCategory }, { type: EntryType.ExportsCategory }]
                : [];
        }
        if (isHint(entry)) {
            return [];
        }
        const service = this._context.bspReportingService;
        switch (entry.type) {
            case EntryType.TeamsCategory:
                return this.load('teams', () => service.getTeams(),
                    'Teams are only listed for admins of teams with Business Success Plan benefits.');
            case EntryType.ExportsCategory:
                return this.load('exports', () => service.getExports(),
                    'Use "Create Export" to request a new export. Exports are deleted after two weeks.');
            case EntryType.Export:
                return service.getDownloads(entry);
            default:
                return [];
        }
    }

    private async load(what: string, fetch: () => Promise<BspReportingEntry[]>, emptyTooltip: string): Promise<BspReportingEntry[]> {
        try {
            const entries = await fetch();
            return entries.length > 0 ? entries : [{ hint: `No ${what} found.`, tooltip: emptyTooltip }];
        } catch (err: any) {
            this._context.log.error(`Could not retrieve ${what}`);
            this._context.log.error(err);
            const status = err?.response?.status;
            const tooltip = status === 401 || status === 403
                ? 'Make sure you are signed in as an admin of a team with Business Success Plan benefits, with the data:read scope.'
                : `An error occurred while retrieving data from the Business Success Plan Reporting API: ${err?.message ?? err}`;
            return [{ hint: `Could not retrieve ${what}.`, tooltip }];
        }
    }
}
