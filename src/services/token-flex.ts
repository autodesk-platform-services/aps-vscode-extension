import { IAuthenticationProvider } from '@aps_sdk/autodesk-sdkmanager';
import {
    EntryType,
    ITokenFlexContract,
    ITokenFlexContractYear,
    ITokenFlexLastUpdated,
    ITokenFlexUsageSummary,
    TokenFlexContract,
    TokenFlexContractDetails,
    TokenFlexLastUpdated,
    TokenFlexQueryResponse,
    TokenFlexQueryResult,
    TokenFlexUsageQuery,
    TokenFlexUsageSummary,
    TokenFlexUsageSummaryFilter
} from '../models/token-flex';
import { RestClient, delay } from './rest-client';

const DEFAULT_HOST = 'https://developer.api.autodesk.com';
const QUERY_PAGE_LIMIT = 1000;
const QUERY_POLL_INTERVAL_MS = 2000;

/**
 * Scopes the Token Flex Usage Data API needs. Reading (including ad-hoc usage queries) only needs
 * `data:read`, which is part of the default sign-in scopes.
 */
export const TOKEN_FLEX_SCOPES: string[] = ['data:read'];

export interface IQueryOptions {
    /** Called with the query status every time it is polled. */
    onStatus?: (status: string) => void;
    /** Aborts polling (the query itself keeps running on the server). */
    signal?: AbortSignal;
    /** Delay between status checks; defaults to 2 seconds. */
    pollIntervalMs?: number;
}

/**
 * Domain logic for the Token Flex Usage Data API, which reports token consumption of Token Flex contracts.
 * There is no official `@aps_sdk/*` SDK for it, so this is a minimal REST wrapper on top of the built-in
 * `fetch`. The API needs a 3-legged token of a Token Flex administrator (or a client ID that Autodesk has
 * associated with one), so the authentication provider is always the active user session.
 */
export class TokenFlexService {
    private readonly rest: RestClient;

    constructor(authenticationProvider: IAuthenticationProvider, host?: string) {
        this.rest = new RestClient(`${host || DEFAULT_HOST}/tokenflex/v1`, authenticationProvider, TOKEN_FLEX_SCOPES);
    }

    private get<T>(url: string): Promise<T> {
        return this.rest.request<T>({ method: 'GET', url });
    }

    private contractPath(prefix: 'contract' | 'usage', contractNumber: string): string {
        return `/${prefix}/${encodeURIComponent(contractNumber)}`;
    }

    /** Lists the contracts the signed-in user administers. Users who aren't Token Flex administrators get an empty list. */
    async getContracts(): Promise<ITokenFlexContract[]> {
        const contracts = await this.get<TokenFlexContract[]>('/contract');
        return (contracts ?? []).map(contract => ({ ...contract, type: EntryType.Contract }));
    }

    getContract(contractNumber: string): Promise<TokenFlexContractDetails> {
        return this.get<TokenFlexContractDetails>(this.contractPath('contract', contractNumber));
    }

    async getContractYears(contractNumber: string): Promise<ITokenFlexContractYear[]> {
        const details = await this.getContract(contractNumber);
        return (details.contractYears ?? []).map(year => ({ ...year, type: EntryType.ContractYear, contractNumber }));
    }

    /** Monthly usage per usage category, newest month first. */
    async getUsageSummary(contractNumber: string, filter: TokenFlexUsageSummaryFilter = {}): Promise<ITokenFlexUsageSummary[]> {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(filter)) {
            if (value !== undefined && value !== '') {
                params.set(key, String(value));
            }
        }
        const query = params.toString();
        const summary = await this.get<TokenFlexUsageSummary[]>(`${this.contractPath('usage', contractNumber)}/summary${query ? `?${query}` : ''}`);
        return (summary ?? [])
            .map(entry => ({ ...entry, type: EntryType.UsageSummary as const, contractNumber }))
            .sort((a, b) => b.usageMonth.localeCompare(a.usageMonth) || a.usageCategory.localeCompare(b.usageCategory));
    }

    /** When usage data was last received, per usage and charge category. */
    async getLastUpdated(contractNumber: string): Promise<ITokenFlexLastUpdated[]> {
        const entries = await this.get<TokenFlexLastUpdated[]>(`${this.contractPath('usage', contractNumber)}/last`);
        return (entries ?? []).map(entry => ({ ...entry, type: EntryType.LastUpdated, contractNumber }));
    }

    /** Launches an ad-hoc usage query. If the same query was completed recently, the response may already be `DONE` with results. */
    submitUsageQuery(contractNumber: string, query: TokenFlexUsageQuery): Promise<TokenFlexQueryResponse> {
        return this.rest.request<TokenFlexQueryResponse>({ method: 'POST', url: `${this.contractPath('usage', contractNumber)}/query`, data: query });
    }

    getUsageQuery(contractNumber: string, queryId: string, offset = 0, limit = QUERY_PAGE_LIMIT): Promise<TokenFlexQueryResponse> {
        const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
        return this.get<TokenFlexQueryResponse>(`${this.contractPath('usage', contractNumber)}/query/${encodeURIComponent(queryId)}?${params.toString()}`);
    }

    /**
     * Runs an ad-hoc usage query to completion: submits it, polls until it's `DONE`, and collects every page
     * of results. Throws if the query fails, times out, or its results expire.
     */
    async runUsageQuery(contractNumber: string, query: TokenFlexUsageQuery, options: IQueryOptions = {}): Promise<TokenFlexQueryResult> {
        const interval = options.pollIntervalMs ?? QUERY_POLL_INTERVAL_MS;
        let response = await this.submitUsageQuery(contractNumber, query);
        const queryId = response.id;
        while (response.status !== 'DONE' || !response.result) {
            options.onStatus?.(response.status);
            if (response.status === 'FAILED' || response.status === 'TIMEOUT' || response.status === 'EXPIRED') {
                throw new Error(`Usage query ${queryId} finished with status ${response.status}.`);
            }
            await delay(interval, options.signal);
            response = await this.getUsageQuery(contractNumber, queryId);
        }
        options.onStatus?.(response.status);
        const { columns, total } = response.result;
        let rows = response.result.rows ?? [];
        while (rows.length < total) {
            options.signal?.throwIfAborted();
            const page = await this.getUsageQuery(contractNumber, queryId, rows.length);
            if (page.status !== 'DONE' || !page.result) {
                throw new Error(`Usage query ${queryId} results are no longer available (status ${page.status}).`);
            }
            if (!page.result.rows?.length) {
                break;
            }
            rows = rows.concat(page.result.rows);
        }
        return { id: queryId, columns, rows };
    }
}
