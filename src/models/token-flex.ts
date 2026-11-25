// Types for the Token Flex Usage Data API (https://aps.autodesk.com/en/docs/tokenflex/v1/). There is no
// official `@aps_sdk/*` package for this API, so the REST shapes are declared here by hand.

/** A contract accessible to the signed-in Token Flex administrator (`GET contract`). */
export interface TokenFlexContract {
    contractNumber: string;
    contractName: string;
    contractStartDate: string;
    contractEndDate: string;
    isActive: boolean;
}

/** One year of a contract, as part of {@link TokenFlexContractDetails}. Consumed/remaining counts are snapshots and may not match the usage endpoints. */
export interface TokenFlexContractYear {
    year: number;
    startDate: string;
    endDate: string;
    provisionedTokens: number;
    consumedTokens: number;
    remainingTokens: number;
    multiyearTokensAtStart?: number;
    multiyearConsumedTokens?: number;
}

/** Details of a contract (`GET contract/:contract_number`). */
export interface TokenFlexContractDetails extends TokenFlexContract {
    multiyearProvisionedTokens?: number;
    contractYears?: TokenFlexContractYear[];
}

/** Monthly aggregated usage for one usage category (`GET usage/:contract_number/summary`). */
export interface TokenFlexUsageSummary {
    usageMonth: string;
    contractYear: number;
    usageCategory: string;
    uniqueUsers: number;
    tokensConsumed: number;
}

/** Optional filters of `GET usage/:contract_number/summary`. */
export interface TokenFlexUsageSummaryFilter {
    minUsageMonth?: string;
    maxUsageMonth?: string;
    contractYear?: number;
    usageCategory?: string;
}

/** When usage data was last received for a usage/charge category (`GET usage/:contract_number/last`). */
export interface TokenFlexLastUpdated {
    usageCategory: string;
    chargeCategory: string;
    lastUsageDate: string;
    lastProcessDate: string;
}

/** Body of `POST usage/:contract_number/query`. A query needs `fields`, `metrics`, or both. */
export interface TokenFlexUsageQuery {
    fields?: string[];
    metrics?: string[];
    usageCategory?: string[];
    where?: string;
}

export type TokenFlexQueryStatus = 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED' | 'TIMEOUT' | 'EXPIRED';

/** Status (and, once `DONE`, one page of results) of an ad-hoc usage query (`GET usage/:contract_number/query/:query_id`). */
export interface TokenFlexQueryResponse {
    id: string;
    status: TokenFlexQueryStatus;
    detail_uri?: string;
    result?: {
        columns: string[];
        rows: unknown[][];
        total: number;
        offset: number;
        limit: number;
    };
}

/** Results of a completed ad-hoc usage query, with all pages combined. */
export interface TokenFlexQueryResult {
    id: string;
    columns: string[];
    rows: unknown[][];
}

/** Fields that can be used in ad-hoc usage queries (session-level fields that are only available in exports are left out). */
export const TOKEN_FLEX_QUERY_FIELDS: string[] = [
    'productLineCode', 'productName', 'userName', 'usageDate', 'usageMonth', 'contractYear', 'usageCategory',
    'productVersion', 'productFeatureCode', 'machineName', 'licenseServerName', 'usageType', 'reasonType', 'tokenPool',
    'customField1', 'customField2', 'customField3', 'customField4', 'customField5',
    'customField6', 'customField7', 'customField8', 'customField9', 'customField10'
];

/** Metrics that can be used in ad-hoc usage queries. */
export const TOKEN_FLEX_QUERY_METRICS: string[] = ['tokensConsumed', 'uniqueUsers', 'uniqueProducts', 'usageMinutes', 'usageHours', 'useCount'];

/** Usage categories that ad-hoc usage queries can be limited to. */
export const TOKEN_FLEX_USAGE_CATEGORIES: string[] = ['DESKTOP_PRODUCT', 'CLOUD_PRODUCT', 'CLOUD_SERVICE', 'MANUAL_ADJUSTMENT', 'MANUAL_CONSUMPTION'];

export enum EntryType {
    Contract = 'token-flex-contract',
    ContractYearsCategory = 'token-flex-contract-years-category',
    UsageSummaryCategory = 'token-flex-usage-summary-category',
    LastUpdatedCategory = 'token-flex-last-updated-category',
    ContractYear = 'token-flex-contract-year',
    UsageSummary = 'token-flex-usage-summary',
    LastUpdated = 'token-flex-last-updated'
}

export interface ITokenFlexContract extends TokenFlexContract {
    type: EntryType.Contract;
}

export interface ITokenFlexCategory {
    type: EntryType.ContractYearsCategory | EntryType.UsageSummaryCategory | EntryType.LastUpdatedCategory;
    contractNumber: string;
}

export interface ITokenFlexContractYear extends TokenFlexContractYear {
    type: EntryType.ContractYear;
    contractNumber: string;
}

export interface ITokenFlexUsageSummary extends TokenFlexUsageSummary {
    type: EntryType.UsageSummary;
    contractNumber: string;
}

export interface ITokenFlexLastUpdated extends TokenFlexLastUpdated {
    type: EntryType.LastUpdated;
    contractNumber: string;
}
