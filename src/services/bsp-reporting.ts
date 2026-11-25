import * as fs from 'fs';
import { IAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager';
import {
    BspReportingContext,
    BspReportingExport,
    BspReportingExportRequest,
    BspReportingPagination,
    BspReportingQueryResponse,
    BspReportingQueryResult,
    BspReportingUsageQuery,
    EntryType,
    IBspReportingDownload,
    IBspReportingExport,
    IBspReportingTeam
} from '../models/bsp-reporting';
import { RestClient, delay } from './rest-client';

const DEFAULT_HOST = 'https://developer.api.autodesk.com';
/** Page size for query results and export listings (the API's documented default). */
const PAGE_LIMIT = 100;
const POLL_INTERVAL_MS = 2000;

/**
 * Scopes the Business Success Plan Reporting API needs: `data:read` for reading, `data:write` for submitting
 * usage queries and exports. Both are part of the default sign-in scopes.
 */
export const BSP_REPORTING_SCOPES: string[] = ['data:read', 'data:write'];

export interface IPollOptions {
    /** Called with the job status every time it is polled. */
    onStatus?: (status: string) => void;
    /** Aborts polling (the job itself keeps running on the server). */
    signal?: AbortSignal;
    /** Delay between status checks; defaults to 2 seconds. */
    pollIntervalMs?: number;
}

/**
 * Domain logic for the Business Success Plan Reporting API (`/insights/v1`), which reports seat usage and token
 * consumption of teams with Business Success Plan benefits. There is no official `@aps_sdk/*` SDK for it, so this
 * is a minimal REST wrapper on top of the built-in `fetch`. The API needs a 3-legged token of a team admin with
 * Business Success Plan benefits, so the authentication provider is always the active user session.
 */
export class BspReportingService {
    private readonly rest: RestClient;

    constructor(authenticationProvider: IAuthenticationProvider, host?: string) {
        this.rest = new RestClient(`${host || DEFAULT_HOST}/insights/v1`, authenticationProvider, BSP_REPORTING_SCOPES);
    }

    private get<T>(url: string): Promise<T> {
        return this.rest.request<T>({ method: 'GET', url });
    }

    /** Lists the teams (contexts) the signed-in user can report on. */
    async getTeams(): Promise<IBspReportingTeam[]> {
        const contexts = await this.get<BspReportingContext[]>('/contexts');
        return (contexts ?? [])
            .map(context => ({ ...context, type: EntryType.Team as const }))
            .sort((a, b) => (a.alias || a.contextId).localeCompare(b.alias || b.contextId));
    }

    /** Submits a usage query. Queries are processed asynchronously; see {@link runUsageQuery}. */
    submitUsageQuery(query: BspReportingUsageQuery, offset = 0, limit = PAGE_LIMIT): Promise<BspReportingQueryResponse> {
        const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
        if (query.contextId) {
            params.set('contextId', query.contextId);
        }
        return this.rest.request<BspReportingQueryResponse>({ method: 'POST', url: `/usage-queries?${params.toString()}`, data: query });
    }

    getUsageQuery(queryId: string, offset = 0, limit = PAGE_LIMIT): Promise<BspReportingQueryResponse> {
        const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
        return this.get<BspReportingQueryResponse>(`/usage-queries/${encodeURIComponent(queryId)}?${params.toString()}`);
    }

    /**
     * Runs a usage query to completion: submits it, polls until it's `COMPLETED`, and collects every page of
     * results. Throws if the query fails or its results expire.
     */
    async runUsageQuery(query: BspReportingUsageQuery, options: IPollOptions = {}): Promise<BspReportingQueryResult> {
        const interval = options.pollIntervalMs ?? POLL_INTERVAL_MS;
        let response = await this.submitUsageQuery(query);
        const queryId = response.id;
        while (response.status !== 'COMPLETED') {
            options.onStatus?.(response.status);
            if (response.status === 'ERROR' || response.status === 'EXPIRED') {
                throw new Error(`Usage query ${queryId} finished with status ${response.status}.`);
            }
            await delay(interval, options.signal);
            response = await this.getUsageQuery(queryId);
        }
        options.onStatus?.(response.status);
        const columns = response.columns ?? [];
        const total = response.pagination?.totalResults ?? 0;
        let rows = response.rows ?? [];
        while (rows.length < total) {
            options.signal?.throwIfAborted();
            const page = await this.getUsageQuery(queryId, rows.length);
            if (page.status !== 'COMPLETED') {
                throw new Error(`Usage query ${queryId} results are no longer available (status ${page.status}).`);
            }
            if (!page.rows?.length) {
                break;
            }
            rows = rows.concat(page.rows);
        }
        return { id: queryId, columns, rows };
    }

    /** Lists the export requests of the last two weeks (older ones are deleted), newest first, optionally only those of one team. */
    async getExports(teamId?: string): Promise<IBspReportingExport[]> {
        let exports: BspReportingExport[] = [];
        let total = 0;
        do {
            const params = new URLSearchParams({ offset: String(exports.length), limit: String(PAGE_LIMIT) });
            if (teamId) {
                params.set('teamId', teamId);
            }
            const page = await this.get<{ exports?: BspReportingExport[]; pagination?: BspReportingPagination }>(`/exports?${params.toString()}`);
            const items = page?.exports ?? [];
            exports = exports.concat(items);
            total = page?.pagination?.totalResults ?? 0;
            if (items.length === 0) {
                break;
            }
        } while (exports.length < total);
        return exports
            .map(item => ({ ...item, type: EntryType.Export as const }))
            .sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));
    }

    getExport(exportId: string): Promise<BspReportingExport> {
        return this.get<BspReportingExport>(`/exports/${encodeURIComponent(exportId)}`);
    }

    /** The downloads of a completed export, as tree entries. */
    getDownloads(item: BspReportingExport): IBspReportingDownload[] {
        // The download URL is left out: it expires after a few minutes, so downloads always fetch a fresh one.
        return (item.downloads ?? []).map(download => ({ type: EntryType.Download, reportType: download.type, exportId: item.id, outputFormat: item.outputFormat }));
    }

    /** Submits an export request. Exports are processed asynchronously; see {@link runExport}. */
    submitExport(request: BspReportingExportRequest): Promise<BspReportingExport> {
        return this.rest.request<BspReportingExport>({ method: 'POST', url: '/exports', data: request });
    }

    /** Submits an export request and polls until it's `COMPLETED`. Throws if the export fails or expires. */
    async runExport(request: BspReportingExportRequest, options: IPollOptions = {}): Promise<BspReportingExport> {
        const interval = options.pollIntervalMs ?? POLL_INTERVAL_MS;
        let response = await this.submitExport(request);
        const exportId = response.id;
        while (response.status !== 'COMPLETED') {
            options.onStatus?.(response.status);
            if (response.status === 'ERROR' || response.status === 'EXPIRED') {
                throw new Error(`Export ${exportId} finished with status ${response.status}.`);
            }
            await delay(interval, options.signal);
            response = await this.getExport(exportId);
        }
        options.onStatus?.(response.status);
        return response;
    }

    /**
     * Downloads one file of a completed export to a local path. Download URLs expire after a few minutes, so the
     * export is fetched again first to get a fresh one. `type` picks the download when there are several.
     */
    async downloadExport(exportId: string, type: string | undefined, filePath: string, signal?: AbortSignal): Promise<void> {
        const details = await this.getExport(exportId);
        if (details.status !== 'COMPLETED') {
            throw new Error(`Export ${exportId} cannot be downloaded (status ${details.status}).`);
        }
        const download = type ? details.downloads?.find(item => item.type === type) : details.downloads?.[0];
        if (!download?.downloadURL) {
            throw new Error(type ? `Export ${exportId} has no ${type} download.` : `Export ${exportId} has no downloads.`);
        }
        signal?.throwIfAborted();
        // The download URL is pre-signed, so it must not get the bearer token.
        const response = await fetch(download.downloadURL, { signal });
        if (!response.ok) {
            throw new Error(`Request failed with status code ${response.status}`);
        }
        await fs.promises.writeFile(filePath, new Uint8Array(await response.arrayBuffer()));
    }
}
