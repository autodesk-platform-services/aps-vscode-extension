// Types for the Business Success Plan Reporting API (https://aps.autodesk.com/en/docs/insights/v1/), also known as
// the Insights API: usage queries and usage exports for teams with Business Success Plan benefits. There is no
// official `@aps_sdk/*` package for this API, so the REST shapes are declared here by hand.

/** A context (team) the signed-in admin can report on (`GET contexts`). */
export interface BspReportingContext {
    contextId: string;
    alias: string;
    /** E.g. `ReportingAdvanced`, `ReportingAPIAccess`, `ReportingSeatUsage`, `ReportingFlexUsage`, `ReportingConsumption`, `InsightsTeam`. */
    reportingBenefits?: string[];
}

export interface BspReportingPagination {
    totalResults: number;
    offset: number;
    limit: number;
}

/** Body of `POST usage-queries`. A query needs `fields`, `metrics`, or both. */
export interface BspReportingUsageQuery {
    fields?: string[];
    metrics?: string[];
    where?: string;
    orderBy?: string;
    /** Limits the query to one team; omit to query all teams the user administers. */
    contextId?: string;
}

export type BspReportingQueryStatus = 'SUBMITTED' | 'RUNNING' | 'COMPLETED' | 'EXPIRED' | 'ERROR';

/** Status (and, once `COMPLETED`, one page of results) of a usage query (`POST usage-queries`, `GET usage-queries/:queryId`). */
export interface BspReportingQueryResponse {
    id: string;
    status: BspReportingQueryStatus;
    startTime?: number;
    columns?: string[];
    rows?: unknown[][];
    pagination?: BspReportingPagination;
}

/** Results of a completed usage query, with all pages combined. */
export interface BspReportingQueryResult {
    id: string;
    columns: string[];
    rows: unknown[][];
}

export type BspReportingExportFormat = 'CSV' | 'EXCEL' | 'JSON';
export type BspReportingExportReport = 'SUBSCRIPTIONS' | 'USERS' | 'GROUPS' | 'USAGE' | 'USAGE_REPORT';
export type BspReportingExportStatus = 'SUBMITTED' | 'COMPLETED' | 'EXPIRED' | 'ERROR';

/** Filters of a `USAGE_REPORT` export. */
export interface BspReportingUsageReportFilters {
    groupId?: string[];
    productLineCode?: string[];
    source?: string[];
    assigned?: boolean;
    userStatus?: string[];
    userId?: string[];
    versionId?: string[];
}

/** Body of `POST exports`. */
export interface BspReportingExportRequest {
    /** Limits the export to one team; omit to export data from all teams the user administers. */
    teamId?: string;
    outputFormat: BspReportingExportFormat;
    reports: BspReportingExportReport[];
    /** Required for `USAGE` and `USAGE_REPORT` exports (ISO 8601, UTC). */
    startDate?: string;
    /** Required for `USAGE` and `USAGE_REPORT` exports (ISO 8601, UTC). */
    endDate?: string;
    /** Required for `USAGE_REPORT` exports. */
    usageReports?: string[];
    filters?: BspReportingUsageReportFilters;
}

export interface BspReportingExportDownload {
    type: string;
    /** Pre-signed URL that expires after a few minutes; get the export again for a fresh one. */
    downloadURL: string;
}

/** An export request (`POST exports`, `GET exports`, `GET exports/:exportId`). */
export interface BspReportingExport {
    id: string;
    timestamp: string;
    teamId: string | null;
    teamName: string | null;
    downloads: BspReportingExportDownload[];
    status: BspReportingExportStatus;
    outputFormat: BspReportingExportFormat;
    reports: string[];
    usageReports?: string[];
}

/** Fields that can be used in usage queries. */
export const BSP_REPORTING_QUERY_FIELDS: string[] = [
    'productName', 'usageDate', 'usageMonth', 'usageWeek', 'version', 'minorVersion', 'childProductName', 'tokens',
    'emailAddress', 'firstName', 'lastName', 'userName', 'fullName', 'userId', 'hashedUserId',
    'isParentProduct', 'isProductVersioned', 'reportingEntityId', 'contractNumber', 'productLineCode', 'featureId',
    'source', 'contextId', 'teamName'
];

/** Metrics that can be used in usage queries. */
export const BSP_REPORTING_QUERY_METRICS: string[] = [
    'uniqueUsers', 'uniqueProducts', 'uniqueChildProducts', 'uniqueVersions', 'uniqueMinorVersions',
    'earliestUsageDate', 'latestUsageDate', 'totalTokens', 'averageTokens', 'totalUniqueDays'
];

export const BSP_REPORTING_EXPORT_FORMATS: BspReportingExportFormat[] = ['CSV', 'EXCEL', 'JSON'];

export const BSP_REPORTING_EXPORT_REPORTS: BspReportingExportReport[] = ['SUBSCRIPTIONS', 'USERS', 'GROUPS', 'USAGE', 'USAGE_REPORT'];

/** Reports that need a `startDate` and `endDate`. */
export const BSP_REPORTING_DATED_REPORTS: BspReportingExportReport[] = ['USAGE', 'USAGE_REPORT'];

export enum EntryType {
    TeamsCategory = 'bsp-reporting-teams-category',
    ExportsCategory = 'bsp-reporting-exports-category',
    Team = 'bsp-reporting-team',
    Export = 'bsp-reporting-export',
    Download = 'bsp-reporting-download'
}

export interface IBspReportingCategory {
    type: EntryType.TeamsCategory | EntryType.ExportsCategory;
}

export interface IBspReportingTeam extends BspReportingContext {
    type: EntryType.Team;
}

export interface IBspReportingExport extends BspReportingExport {
    type: EntryType.Export;
}

/** One file of a completed export. The download's own `type` (which report it contains) is exposed as `reportType`. */
export interface IBspReportingDownload {
    type: EntryType.Download;
    reportType: string;
    exportId: string;
    outputFormat: BspReportingExportFormat;
}
