import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { Dropdown, Option } from './components/controls';
import { TokenFlexContractYear, TokenFlexUsageSummary } from '../models/token-flex';
import { BarChart, numberFormat, useThemeColors } from './components/BarChart';
import { buildContractYearsData, buildMonthlyUsageData, getContractYears, UsageMetric } from './token-flex-chart-data';

export interface ITokenFlexUsageChartProps {
    contractNumber: string;
    contractName: string;
    summary: TokenFlexUsageSummary[];
    contractYears: TokenFlexContractYear[];
}

const METRIC_LABELS: Record<UsageMetric, string> = {
    tokensConsumed: 'Tokens consumed',
    uniqueUsers: 'Unique users'
};

const ALL_YEARS = 'all';

const TokenFlexUsageChart = ({ contractNumber, contractName, summary, contractYears }: ITokenFlexUsageChartProps) => {
    const colors = useThemeColors();
    const [metric, setMetric] = React.useState<UsageMetric>('tokensConsumed');
    const [year, setYear] = React.useState<string>(ALL_YEARS);
    const years = React.useMemo(() => getContractYears(summary), [summary]);
    const monthly = React.useMemo(
        () => buildMonthlyUsageData(summary, metric, year === ALL_YEARS ? undefined : Number(year)),
        [summary, metric, year]
    );
    const yearly = React.useMemo(() => buildContractYearsData(contractYears), [contractYears]);
    const total = monthly.series.reduce((sum, series) => sum + series.data.reduce((a, b) => a + b, 0), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '16px' }}>
            <h1>Token Flex usage: {contractName || contractNumber}</h1>
            <p style={{ margin: 0 }}>Contract {contractNumber}</p>

            <h2 style={{ marginBottom: 0 }}>Monthly usage</h2>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    Metric
                    <Dropdown value={metric} onChange={ev => setMetric((ev.target as any).value as UsageMetric)}>
                        {Object.entries(METRIC_LABELS).map(([value, label]) => <Option key={value} value={value}>{label}</Option>)}
                    </Dropdown>
                </label>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    Contract year
                    <Dropdown value={year} onChange={ev => setYear((ev.target as any).value)}>
                        <Option value={ALL_YEARS}>All years</Option>
                        {years.map(y => <Option key={y} value={String(y)}>Year {y}</Option>)}
                    </Dropdown>
                </label>
                {metric === 'tokensConsumed' && <span>Total: {numberFormat.format(total)} tokens</span>}
            </div>
            {monthly.labels.length > 0
                ? <BarChart data={monthly} stacked={metric === 'tokensConsumed'} yTitle={METRIC_LABELS[metric]} colors={colors} />
                : <p>No usage data available.</p>}

            {yearly.labels.length > 0 && (
                <>
                    <h2 style={{ marginBottom: 0 }}>Tokens per contract year</h2>
                    <BarChart data={yearly} stacked={true} yTitle="Tokens" colors={colors} />
                </>
            )}
        </div>
    );
};

export function render(container: HTMLElement, props: ITokenFlexUsageChartProps) {
    ReactDOM.createRoot(container).render(<TokenFlexUsageChart {...props} />);
}
