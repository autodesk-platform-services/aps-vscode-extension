import * as vscode from 'vscode';
import { IContext, command, createWebViewPanel, isCancellation, showReadOnlyJson, toAbortSignal, withProgress } from '../common';
import {
    BSP_REPORTING_DATED_REPORTS,
    BSP_REPORTING_EXPORT_FORMATS,
    BSP_REPORTING_EXPORT_REPORTS,
    BSP_REPORTING_QUERY_FIELDS,
    BSP_REPORTING_QUERY_METRICS,
    BspReportingExport,
    BspReportingExportFormat,
    BspReportingExportReport,
    BspReportingExportRequest,
    BspReportingQueryResult,
    BspReportingUsageQuery,
    EntryType,
    IBspReportingCategory,
    IBspReportingDownload,
    IBspReportingExport,
    IBspReportingTeam
} from '../models/bsp-reporting';
import type { IBspReportingUsageChartProps } from '../webviews/bsp-reporting-usage-chart';

const FILE_EXTENSIONS: Record<BspReportingExportFormat, string> = { CSV: 'csv', EXCEL: 'xlsx', JSON: 'json' };
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
/** `USAGE_REPORT` exports can cover at most one year. */
const MAX_USAGE_REPORT_DAYS = 365;

/** How many months of usage the "View Usage Chart" command covers. */
const USAGE_CHART_MONTHS = 12;

/** Result of the team prompt: a team ID, or `null` for all teams the user administers. */
type TeamChoice = string | null;

export class BspReportingCommands {
    /** Open "View Usage Chart" panels by team ID (or "all"), so re-running the command refreshes and reveals the existing panel. */
    private readonly chartPanels = new Map<string, vscode.WebviewPanel>();

    constructor(protected context: IContext, protected refresh: () => void) {
    }

    registerCommands(): vscode.Disposable[] {
        return [
            command(this.context, 'aps.bspReporting.refresh', this.refreshBspReporting.bind(this)),
            command(this.context, 'aps.bspReporting.copyTeamId', this.copyTeamId.bind(this)),
            command(this.context, 'aps.bspReporting.runUsageQuery', 'Could not run usage query', this.runUsageQuery.bind(this)),
            command(this.context, 'aps.bspReporting.viewUsageChart', 'Could not show usage chart', this.viewUsageChart.bind(this)),
            command(this.context, 'aps.bspReporting.createExport', 'Could not create export', this.createExport.bind(this)),
            command(this.context, 'aps.bspReporting.viewExportDetails', 'Could not retrieve export details', this.viewExportDetails.bind(this)),
            command(this.context, 'aps.bspReporting.downloadExport', 'Could not download export', this.downloadExport.bind(this)),
        ];
    }

    protected ensureInput<T>(input: T | undefined): T {
        if (!input) {
            throw new Error('This command can only be triggered from the tree view.');
        }
        return input;
    }

    async refreshBspReporting() {
        this.refresh();
    }

    async copyTeamId(team?: IBspReportingTeam) {
        team = this.ensureInput(team);
        await vscode.env.clipboard.writeText(team.contextId);
        vscode.window.showInformationMessage(`Team ID copied to clipboard: ${team.contextId}`);
    }

    /**
     * Builds a usage query from quick-picks (fields, metrics, and optional `where`/`orderBy` clauses), runs it to
     * completion, shows the results as JSON, and offers to preview them as a chart. Triggered from a team (queries
     * that team) or from the "Teams" node or the Command Palette (prompts for a team, or all teams).
     */
    async runUsageQuery(entry?: IBspReportingTeam | IBspReportingCategory) {
        const teamId = entry?.type === EntryType.Team ? entry.contextId : await this.promptTeam();
        if (teamId === undefined) {
            return;
        }
        const query = await this.promptUsageQuery(teamId);
        if (!query) {
            return;
        }
        const result = await this.runQuery(query, `Running usage query${teamId ? `: ${teamId}` : ''}`);
        if (!result) {
            return;
        }
        const rows = result.rows.map(row => Object.fromEntries(result.columns.map((column, i) => [column, row[i]])));
        await showReadOnlyJson(this.context, ['business-success-plan-reporting', 'queries', result.id], { query, total: rows.length, rows });
        if (result.rows.length > 0) {
            const action = await vscode.window.showInformationMessage(`Usage query completed: ${rows.length} rows`, 'View Chart');
            if (action === 'View Chart') {
                this.showUsageChart(`Usage Query: ${result.id}`, query, result);
            }
        }
    }

    /**
     * Builds a usage query from the same prompts as "Run Usage Query", pre-filled with monthly usage per product over
     * the last 12 months, runs it, and shows the results as an interactive bar chart. Triggered from a team (that
     * team) or from the "Teams" node or the Command Palette (prompts for a team, or all teams).
     */
    async viewUsageChart(entry?: IBspReportingTeam | IBspReportingCategory) {
        const team = entry?.type === EntryType.Team ? entry : undefined;
        const teamId = team ? team.contextId : await this.promptTeam();
        if (teamId === undefined) {
            return;
        }
        const since = new Date();
        since.setUTCMonth(since.getUTCMonth() - USAGE_CHART_MONTHS, 1);
        const query = await this.promptUsageQuery(teamId, {
            fields: ['usageMonth', 'productName'],
            metrics: ['uniqueUsers', 'totalTokens', 'totalUniqueDays'],
            where: `usageDate >= '${since.toISOString().substring(0, 10)}'`
        });
        if (!query) {
            return;
        }
        const result = await this.runQuery(query, `Getting usage data${teamId ? `: ${teamId}` : ''}`);
        if (!result) {
            return;
        }
        const key = teamId ?? 'all';
        const existing = this.chartPanels.get(key);
        const panel = this.showUsageChart(`Business Success Plan Usage: ${team?.alias || teamId || 'All teams'}`, query, result, existing);
        if (existing) {
            existing.reveal();
        } else {
            this.chartPanels.set(key, panel);
            panel.onDidDispose(() => this.chartPanels.delete(key));
        }
    }

    /** Runs a usage query with cancellable progress; resolves to `undefined` if cancelled. */
    private async runQuery(query: BspReportingUsageQuery, title: string): Promise<BspReportingQueryResult | undefined> {
        try {
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title,
                cancellable: true
            }, (progress, token) => this.context.bspReportingService.runUsageQuery(query, {
                onStatus: status => progress.report({ message: status }),
                signal: toAbortSignal(token)
            }));
        } catch (err) {
            if (isCancellation(err)) {
                vscode.window.showInformationMessage('Usage query monitoring cancelled');
                return undefined;
            }
            throw err;
        }
    }

    /** Opens (or re-renders `panel` with) a bar chart of usage query results, rendered with Chart.js in a webview. */
    private showUsageChart(title: string, query: BspReportingUsageQuery, result: BspReportingQueryResult, panel?: vscode.WebviewPanel): vscode.WebviewPanel {
        const props: IBspReportingUsageChartProps = { title, query, columns: result.columns, rows: result.rows };
        return createWebViewPanel(this.context, 'bsp-reporting-usage-chart.js', 'bsp-reporting-usage-chart', title, props, undefined, panel ? { panel } : undefined);
    }

    /**
     * Requests a new export (output format, reports, and a date range for usage reports), waits for it to complete,
     * and offers to download it. Triggered from a team (exports that team), or from the "Exports" node or the
     * Command Palette (prompts for a team, or all teams).
     */
    async createExport(entry?: IBspReportingTeam | IBspReportingCategory) {
        const teamId = entry?.type === EntryType.Team ? entry.contextId : await this.promptTeam();
        if (teamId === undefined) {
            return;
        }
        const request = await this.promptExportRequest(teamId);
        if (!request) {
            return;
        }
        let result: BspReportingExport;
        try {
            result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Exporting ${request.reports.join(', ')}`,
                cancellable: true
            }, (progress, token) => this.context.bspReportingService.runExport(request, {
                onStatus: status => progress.report({ message: status }),
                signal: toAbortSignal(token)
            }));
        } catch (err) {
            if (isCancellation(err)) {
                vscode.window.showInformationMessage('Export monitoring cancelled; the export keeps running and will appear under "Exports" when it completes.');
                return;
            }
            throw err;
        } finally {
            this.refresh();
        }
        const action = await vscode.window.showInformationMessage(`Export completed: ${result.id}`, 'Download');
        if (action === 'Download') {
            await this.downloadExport({ ...result, type: EntryType.Export });
        }
    }

    async viewExportDetails(entry?: IBspReportingExport) {
        entry = this.ensureInput(entry);
        const details = await withProgress(`Getting export details: ${entry.id}`, this.context.bspReportingService.getExport(entry.id));
        await showReadOnlyJson(this.context, ['business-success-plan-reporting', 'exports', entry.id], details);
    }

    /**
     * Saves one file of a completed export. Triggered from a download (that file), from a completed export (prompts
     * for the file if there are several), or from the Command Palette (prompts for the export first).
     */
    async downloadExport(entry?: IBspReportingExport | IBspReportingDownload) {
        const service = this.context.bspReportingService;
        let download: IBspReportingDownload | undefined;
        if (entry?.type === EntryType.Download) {
            download = entry;
        } else {
            const item = entry ?? await this.promptCompletedExport();
            if (!item) {
                return;
            }
            const downloads = service.getDownloads(item);
            if (downloads.length === 0) {
                throw new Error(`Export ${item.id} has no downloads.`);
            }
            download = downloads.length === 1 ? downloads[0] : (await vscode.window.showQuickPick(
                downloads.map(item => ({ label: item.reportType, description: item.outputFormat, download: item })),
                { placeHolder: 'Select a file to download', ignoreFocusOut: true }
            ))?.download;
            if (!download) {
                return;
            }
        }
        const { exportId, reportType, outputFormat } = download;
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${reportType.toLowerCase()}-${exportId}.${FILE_EXTENSIONS[outputFormat] ?? 'dat'}`)
        });
        if (!uri) {
            return;
        }
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Downloading export: ${uri.fsPath}`,
                cancellable: true
            }, (_progress, token) => service.downloadExport(exportId, reportType, uri.fsPath, toAbortSignal(token)));
        } catch (err) {
            if (isCancellation(err)) {
                vscode.window.showInformationMessage(`Download cancelled: ${uri.fsPath}`);
                return;
            }
            throw err;
        }
        const action = await vscode.window.showInformationMessage(`Download complete: ${uri.fsPath}`, 'Open File');
        if (action === 'Open File') {
            vscode.env.openExternal(uri);
        }
    }

    private ensureSession() {
        if (!this.context.session) {
            throw new Error('The Business Success Plan Reporting API requires a user context. Sign in to APS first.');
        }
    }

    /** Prompts for a team; resolves to its ID, `null` for all teams, or `undefined` if cancelled. */
    private async promptTeam(): Promise<TeamChoice | undefined> {
        this.ensureSession();
        const teams = await withProgress('Getting teams...', this.context.bspReportingService.getTeams());
        if (teams.length === 0) {
            vscode.window.showInformationMessage('No teams found. Teams are only listed for admins of teams with Business Success Plan benefits.');
            return undefined;
        }
        const picked = await vscode.window.showQuickPick<vscode.QuickPickItem & { teamId: TeamChoice }>([
            { label: 'All teams', description: 'Every team you administer', teamId: null },
            ...teams.map(team => ({
                label: team.alias || team.contextId,
                description: team.contextId,
                detail: team.reportingBenefits?.join(', '),
                teamId: team.contextId
            }))
        ], { placeHolder: 'Select a team', ignoreFocusOut: true, matchOnDescription: true });
        return picked?.teamId;
    }

    private async promptCompletedExport(): Promise<IBspReportingExport | undefined> {
        this.ensureSession();
        const exports = (await withProgress('Getting exports...', this.context.bspReportingService.getExports()))
            .filter(item => item.status === 'COMPLETED');
        if (exports.length === 0) {
            vscode.window.showInformationMessage('No completed exports found. Exports are deleted after two weeks.');
            return undefined;
        }
        const picked = await vscode.window.showQuickPick(
            exports.map(item => ({
                label: item.reports.join(', '),
                description: `${item.timestamp} ${item.outputFormat}`,
                detail: item.teamName ? `${item.teamName} (${item.teamId})` : 'All teams',
                item
            })),
            { placeHolder: 'Select an export', ignoreFocusOut: true, matchOnDescription: true, matchOnDetail: true }
        );
        return picked?.item;
    }

    /** Prompts for the fields, metrics, and `where`/`orderBy` clauses of a usage query, pre-selecting `defaults`. */
    private async promptUsageQuery(teamId: TeamChoice, defaults: BspReportingUsageQuery = { fields: ['productName'], metrics: ['uniqueUsers'] }): Promise<BspReportingUsageQuery | undefined> {
        const fields = await vscode.window.showQuickPick(BSP_REPORTING_QUERY_FIELDS.map(label => ({ label, picked: !!defaults.fields?.includes(label) })), {
            canPickMany: true,
            placeHolder: 'Select fields to group usage by (optional if you select metrics)',
            ignoreFocusOut: true
        });
        if (!fields) {
            return undefined;
        }
        const metrics = await vscode.window.showQuickPick(BSP_REPORTING_QUERY_METRICS.map(label => ({ label, picked: !!defaults.metrics?.includes(label) })), {
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
        const where = await vscode.window.showInputBox({
            prompt: 'Optional SQL-style criteria, for example: usageDate >= \'2026-01-01\' AND productLineCode = \'ACD\'',
            placeHolder: 'where clause (optional)',
            value: defaults.where,
            ignoreFocusOut: true
        });
        if (where === undefined) {
            return undefined;
        }
        const orderBy = await vscode.window.showInputBox({
            prompt: 'Optional SQL-style sort order, for example: productName ASC',
            placeHolder: 'order by clause (optional)',
            value: defaults.orderBy,
            ignoreFocusOut: true
        });
        if (orderBy === undefined) {
            return undefined;
        }
        return {
            ...(fields.length > 0 ? { fields: fields.map(item => item.label) } : {}),
            ...(metrics.length > 0 ? { metrics: metrics.map(item => item.label) } : {}),
            ...(where.trim() ? { where: where.trim() } : {}),
            ...(orderBy.trim() ? { orderBy: orderBy.trim() } : {}),
            ...(teamId ? { contextId: teamId } : {})
        };
    }

    private async promptExportRequest(teamId: TeamChoice): Promise<BspReportingExportRequest | undefined> {
        const format = await vscode.window.showQuickPick(BSP_REPORTING_EXPORT_FORMATS, { placeHolder: 'Select an output format', ignoreFocusOut: true });
        if (!format) {
            return undefined;
        }
        const reports = await vscode.window.showQuickPick(BSP_REPORTING_EXPORT_REPORTS.map(label => ({ label })), {
            canPickMany: true,
            placeHolder: 'Select reports to export',
            ignoreFocusOut: true
        });
        if (!reports || reports.length === 0) {
            return undefined;
        }
        const reportNames = reports.map(item => item.label as BspReportingExportReport);
        const request: BspReportingExportRequest = {
            outputFormat: format as BspReportingExportFormat,
            reports: reportNames,
            ...(teamId ? { teamId } : {})
        };
        if (reportNames.some(report => BSP_REPORTING_DATED_REPORTS.includes(report))) {
            const range = await this.promptDateRange(reportNames.includes('USAGE_REPORT') ? MAX_USAGE_REPORT_DAYS : undefined);
            if (!range) {
                return undefined;
            }
            request.startDate = range.startDate;
            request.endDate = range.endDate;
        }
        if (reportNames.includes('USAGE_REPORT')) {
            request.usageReports = ['USAGE_REPORT_BY_PRODUCT'];
        }
        return request;
    }

    /** Prompts for a `YYYY-MM-DD` date range (defaulting to the last 30 days) and returns it as UTC ISO timestamps. */
    private async promptDateRange(maxDays?: number): Promise<{ startDate: string; endDate: string } | undefined> {
        const today = new Date();
        const toDay = (date: Date) => date.toISOString().substring(0, 10);
        const validate = (value: string) => DATE_PATTERN.test(value) && !isNaN(Date.parse(value)) ? undefined : 'Enter a date as YYYY-MM-DD';
        const start = await vscode.window.showInputBox({
            prompt: 'Start date of the exported usage (UTC)',
            value: toDay(new Date(today.getTime() - 30 * DAY_MS)),
            validateInput: validate,
            ignoreFocusOut: true
        });
        if (!start) {
            return undefined;
        }
        const end = await vscode.window.showInputBox({
            prompt: 'End date of the exported usage (UTC)',
            value: toDay(today),
            validateInput: value => {
                const error = validate(value);
                if (error) {
                    return error;
                }
                const days = (Date.parse(value) - Date.parse(start)) / DAY_MS;
                if (days < 0) {
                    return 'The end date must not be before the start date';
                }
                if (maxDays !== undefined && days > maxDays) {
                    return `Usage reports can cover at most ${maxDays} days`;
                }
                return undefined;
            },
            ignoreFocusOut: true
        });
        if (!end) {
            return undefined;
        }
        return { startDate: `${start}T00:00:00Z`, endDate: `${end}T23:59:59Z` };
    }
}
