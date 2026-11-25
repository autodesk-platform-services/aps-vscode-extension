import { IChartData } from './chart-data';

/** Columns preferred as the x-axis, in order (time first). */
const PREFERRED_X_COLUMNS = ['usageMonth', 'usageWeek', 'usageDate'];
const DATE_LIKE = /^\d{4}-\d{2}/;
export const MAX_SERIES = 10;
export const MAX_LABELS = 50;

export interface IQueryColumns {
    /** Columns with values to group by (x-axis or series). */
    categories: string[];
    /** Columns whose values are all numbers, usable as the y-axis. */
    metrics: string[];
}

export interface IQueryChartOptions {
    /** Column providing the x-axis labels; omit to chart every metric column of the first row. */
    xColumn?: string;
    /** Column to split the bars into series by; omit for a single series. */
    seriesColumn?: string;
    metricColumn: string;
}

export interface IQueryChartData extends IChartData {
    /** Number of x-axis labels left out (only the {@link MAX_LABELS} largest are kept). */
    omittedLabels: number;
    /** Number of series left out (only the {@link MAX_SERIES} largest are kept). */
    omittedSeries: number;
}

function toNumber(value: unknown): number | undefined {
    if (typeof value === 'number') {
        return isFinite(value) ? value : undefined;
    }
    if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) {
        return Number(value);
    }
    return undefined;
}

function toLabel(value: unknown): string {
    return value === null || value === undefined || value === '' ? '(none)' : String(value);
}

/** Splits the columns of a usage query result into numeric metrics and categories to group by. */
export function getQueryColumns(columns: string[], rows: unknown[][]): IQueryColumns {
    const categories: string[] = [];
    const metrics: string[] = [];
    columns.forEach((column, i) => {
        const values = rows.map(row => row[i]).filter(value => value !== null && value !== undefined && value !== '');
        const numeric = values.length > 0 && values.every(value => toNumber(value) !== undefined);
        // Year/version-like fields are numbers too, but they read better as categories.
        if (numeric && !PREFERRED_X_COLUMNS.includes(column) && column !== 'version' && column !== 'minorVersion') {
            metrics.push(column);
        } else {
            categories.push(column);
        }
    });
    return { categories, metrics };
}

/** Default chart setup: time on the x-axis if available, the next category as series, and the first metric. */
export function getDefaultChartOptions({ categories, metrics }: IQueryColumns): IQueryChartOptions | undefined {
    if (metrics.length === 0) {
        return undefined;
    }
    const xColumn = PREFERRED_X_COLUMNS.find(column => categories.includes(column)) ?? categories[0];
    const seriesColumn = categories.find(column => column !== xColumn);
    return { xColumn, seriesColumn, metricColumn: metrics[0] };
}

/**
 * Pivots usage query rows into bar chart data: one label per distinct x value, one series per distinct series
 * value, values summed per (label, series). Date-like labels are sorted ascending (keeping the latest
 * {@link MAX_LABELS}), others by total descending (keeping the largest {@link MAX_LABELS}); only the largest
 * {@link MAX_SERIES} series are kept.
 */
export function buildQueryChartData(columns: string[], rows: unknown[][], { xColumn, seriesColumn, metricColumn }: IQueryChartOptions): IQueryChartData {
    const metricIndex = columns.indexOf(metricColumn);
    if (metricIndex < 0) {
        return { labels: [], series: [], omittedLabels: 0, omittedSeries: 0 };
    }
    const xIndex = xColumn ? columns.indexOf(xColumn) : -1;
    if (xIndex < 0) {
        // Nothing to group by: one bar per metric column, from the first row.
        const { metrics } = getQueryColumns(columns, rows);
        const first = rows[0] ?? [];
        return {
            labels: metrics,
            series: [{ label: 'Value', data: metrics.map(metric => toNumber(first[columns.indexOf(metric)]) ?? 0) }],
            omittedLabels: 0,
            omittedSeries: 0
        };
    }
    const seriesIndex = seriesColumn && seriesColumn !== xColumn ? columns.indexOf(seriesColumn) : -1;

    // label -> series -> value
    const values = new Map<string, Map<string, number>>();
    const labelTotals = new Map<string, number>();
    const seriesTotals = new Map<string, number>();
    for (const row of rows) {
        const label = toLabel(row[xIndex]);
        const series = seriesIndex >= 0 ? toLabel(row[seriesIndex]) : metricColumn;
        const value = toNumber(row[metricIndex]) ?? 0;
        const bySeries = values.get(label) ?? new Map<string, number>();
        bySeries.set(series, (bySeries.get(series) ?? 0) + value);
        values.set(label, bySeries);
        labelTotals.set(label, (labelTotals.get(label) ?? 0) + value);
        seriesTotals.set(series, (seriesTotals.get(series) ?? 0) + value);
    }

    const byTotal = (totals: Map<string, number>) => [...totals.keys()].sort((a, b) => totals.get(b)! - totals.get(a)! || a.localeCompare(b));
    const allLabels = [...labelTotals.keys()];
    const labels = allLabels.every(label => DATE_LIKE.test(label))
        ? allLabels.sort().slice(-MAX_LABELS)
        : byTotal(labelTotals).slice(0, MAX_LABELS);
    const seriesNames = byTotal(seriesTotals).slice(0, MAX_SERIES);
    return {
        labels,
        series: seriesNames.map(name => ({ label: name, data: labels.map(label => values.get(label)?.get(name) ?? 0) })),
        omittedLabels: labelTotals.size - labels.length,
        omittedSeries: seriesTotals.size - seriesNames.length
    };
}
