import { TokenFlexContractYear, TokenFlexUsageSummary } from '../models/token-flex';

export type UsageMetric = 'tokensConsumed' | 'uniqueUsers';

export interface ISeries {
    label: string;
    data: number[];
    /** Series with the same stack ID are stacked on top of each other (in stacked charts). */
    stack?: string;
}

export interface IChartData {
    labels: string[];
    series: ISeries[];
}

/** Formats a `YYYY-MM-DD` usage month as `YYYY-MM`. */
function toMonth(usageMonth: string): string {
    return usageMonth.substring(0, 7);
}

/** Contract years present in the usage summary, ascending. */
export function getContractYears(summary: TokenFlexUsageSummary[]): number[] {
    return [...new Set(summary.map(entry => Number(entry.contractYear)))].filter(year => !isNaN(year)).sort((a, b) => a - b);
}

/**
 * Pivots the monthly usage summary into one series per usage category, with one value per month
 * (ascending, `YYYY-MM`). Months without usage in a category get 0. Optionally limited to one contract year.
 */
export function buildMonthlyUsageData(summary: TokenFlexUsageSummary[], metric: UsageMetric, contractYear?: number): IChartData {
    const entries = contractYear === undefined ? summary : summary.filter(entry => Number(entry.contractYear) === contractYear);
    const labels = [...new Set(entries.map(entry => toMonth(entry.usageMonth)))].sort();
    const categories = [...new Set(entries.map(entry => entry.usageCategory))].sort();
    const monthIndex = new Map(labels.map((label, i) => [label, i]));
    const series = categories.map(category => {
        const data = new Array<number>(labels.length).fill(0);
        for (const entry of entries) {
            if (entry.usageCategory === category) {
                data[monthIndex.get(toMonth(entry.usageMonth))!] += entry[metric] ?? 0;
            }
        }
        return { label: category, data };
    });
    return { labels, series };
}

/**
 * Per-contract-year consumed vs. remaining tokens, stacked so that the bar height equals the provisioned
 * tokens. Consumed multi-year tokens (if any) are shown as a separate bar next to it.
 */
export function buildContractYearsData(years: TokenFlexContractYear[]): IChartData {
    const sorted = [...years].sort((a, b) => a.year - b.year);
    const series: ISeries[] = [
        { label: 'Consumed', data: sorted.map(year => year.consumedTokens ?? 0), stack: 'annual' },
        { label: 'Remaining', data: sorted.map(year => Math.max(year.remainingTokens ?? 0, 0)), stack: 'annual' }
    ];
    if (sorted.some(year => year.multiyearConsumedTokens)) {
        series.push({ label: 'Multi-year consumed', data: sorted.map(year => year.multiyearConsumedTokens ?? 0), stack: 'multiyear' });
    }
    return { labels: sorted.map(year => `Year ${year.year}`), series };
}
