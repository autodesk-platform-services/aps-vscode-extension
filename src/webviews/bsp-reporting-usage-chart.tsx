import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { Checkbox, Dropdown, Option } from './components/controls';
import { BarChart, numberFormat, useThemeColors } from './components/BarChart';
import { BspReportingUsageQuery } from '../models/bsp-reporting';
import { buildQueryChartData, getDefaultChartOptions, getQueryColumns, MAX_LABELS, MAX_SERIES } from './bsp-reporting-chart-data';

export interface IBspReportingUsageChartProps {
    title: string;
    query: BspReportingUsageQuery;
    columns: string[];
    rows: unknown[][];
}

const NONE = '';

const BspReportingUsageChart = ({ title, query, columns, rows }: IBspReportingUsageChartProps) => {
    const colors = useThemeColors();
    const queryColumns = React.useMemo(() => getQueryColumns(columns, rows), [columns, rows]);
    const defaults = React.useMemo(() => getDefaultChartOptions(queryColumns), [queryColumns]);
    const [xColumn, setXColumn] = React.useState(defaults?.xColumn ?? NONE);
    const [seriesColumn, setSeriesColumn] = React.useState(defaults?.seriesColumn ?? NONE);
    const [metricColumn, setMetricColumn] = React.useState(defaults?.metricColumn ?? NONE);
    const [stacked, setStacked] = React.useState(false);
    const data = React.useMemo(
        () => buildQueryChartData(columns, rows, { xColumn: xColumn || undefined, seriesColumn: seriesColumn || undefined, metricColumn }),
        [columns, rows, xColumn, seriesColumn, metricColumn]
    );
    const { categories, metrics } = queryColumns;
    const notes = [
        data.omittedLabels > 0 ? `${numberFormat.format(data.omittedLabels)} more ${xColumn} values not shown (only ${MAX_LABELS} are charted).` : '',
        data.omittedSeries > 0 ? `${numberFormat.format(data.omittedSeries)} smaller ${seriesColumn} series not shown (only the top ${MAX_SERIES} are charted).` : ''
    ].filter(Boolean);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '16px' }}>
            <h1>{title}</h1>
            <p style={{ margin: 0 }}>
                {numberFormat.format(rows.length)} rows
                {query.where ? <> · where <code>{query.where}</code></> : null}
                {query.orderBy ? <> · order by <code>{query.orderBy}</code></> : null}
            </p>
            {rows.length === 0 ? (
                <p>The query returned no usage data. Try a longer period, a different team, or fewer conditions in the <code>where</code> clause.</p>
            ) : metrics.length === 0 ? (
                <p>The query results have no numeric columns to chart. Include at least one metric in the query.</p>
            ) : (
                <>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            Metric
                            <Dropdown value={metricColumn} onChange={ev => setMetricColumn((ev.target as any).value)}>
                                {metrics.map(column => <Option key={column} value={column}>{column}</Option>)}
                            </Dropdown>
                        </label>
                        {categories.length > 0 && (
                            <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                X-axis
                                <Dropdown value={xColumn} onChange={ev => {
                                    const value = (ev.target as any).value;
                                    setXColumn(value);
                                    if (value === seriesColumn) {
                                        setSeriesColumn(NONE);
                                    }
                                }}>
                                    {categories.map(column => <Option key={column} value={column}>{column}</Option>)}
                                </Dropdown>
                            </label>
                        )}
                        {categories.length > 1 && (
                            <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                Group by
                                <Dropdown value={seriesColumn} onChange={ev => setSeriesColumn((ev.target as any).value)}>
                                    <Option value={NONE}>None</Option>
                                    {categories.filter(column => column !== xColumn).map(column => <Option key={column} value={column}>{column}</Option>)}
                                </Dropdown>
                            </label>
                        )}
                        {data.series.length > 1 && (
                            <Checkbox checked={stacked} onChange={ev => setStacked(!!(ev.target as any).checked)}>Stacked</Checkbox>
                        )}
                    </div>
                    {data.labels.length > 0
                        ? <BarChart data={data} stacked={stacked} yTitle={metricColumn} colors={colors} />
                        : <p>No usage data available.</p>}
                    {notes.map(note => <p key={note} style={{ margin: 0 }}>{note}</p>)}
                </>
            )}
        </div>
    );
};

export function render(container: HTMLElement, props: IBspReportingUsageChartProps) {
    ReactDOM.createRoot(container).render(<BspReportingUsageChart {...props} />);
}
