import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip } from 'chart.js';
import { Dropdown, Option } from './components/controls';
import { TokenFlexContractYear, TokenFlexUsageSummary } from '../models/token-flex';
import { buildContractYearsData, buildMonthlyUsageData, getContractYears, IChartData, UsageMetric } from './token-flex-chart-data';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export interface ITokenFlexUsageChartProps {
    contractNumber: string;
    contractName: string;
    summary: TokenFlexUsageSummary[];
    contractYears: TokenFlexContractYear[];
}

/** VS Code theme colors meant for charts, in the order series get them. */
const SERIES_COLOR_VARIABLES = ['--vscode-charts-blue', '--vscode-charts-orange', '--vscode-charts-green', '--vscode-charts-purple', '--vscode-charts-red', '--vscode-charts-yellow'];
const FALLBACK_COLORS = ['#3794ff', '#d18616', '#89d185', '#b180d7', '#f14c4c', '#cca700'];

interface IThemeColors {
    series: string[];
    foreground: string;
    grid: string;
    fontFamily: string;
}

function readThemeColors(): IThemeColors {
    const style = getComputedStyle(document.body);
    const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    return {
        series: SERIES_COLOR_VARIABLES.map((name, i) => read(name, FALLBACK_COLORS[i])),
        foreground: read('--vscode-foreground', '#cccccc'),
        grid: read('--vscode-widget-border', 'rgba(128, 128, 128, 0.25)'),
        fontFamily: read('--vscode-font-family', 'sans-serif')
    };
}

/** Re-reads the theme colors whenever VS Code switches color themes (it updates the attributes of `<body>`). */
function useThemeColors(): IThemeColors {
    const [colors, setColors] = React.useState(readThemeColors);
    React.useEffect(() => {
        const observer = new MutationObserver(() => setColors(readThemeColors()));
        observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-vscode-theme-kind'] });
        return () => observer.disconnect();
    }, []);
    return colors;
}

const numberFormat = new Intl.NumberFormat();

interface IBarChartProps {
    data: IChartData;
    stacked: boolean;
    yTitle: string;
    colors: IThemeColors;
}

const BarChart = ({ data, stacked, yTitle, colors }: IBarChartProps) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        Chart.defaults.font.family = colors.fontFamily;
        Chart.defaults.color = colors.foreground;
        const chart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: data.series.map((series, i) => ({
                    label: series.label,
                    data: series.data,
                    ...(series.stack ? { stack: series.stack } : {}),
                    backgroundColor: colors.series[i % colors.series.length]
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { stacked, grid: { color: colors.grid } },
                    y: {
                        stacked,
                        beginAtZero: true,
                        grid: { color: colors.grid },
                        title: { display: true, text: yTitle },
                        ticks: { callback: value => numberFormat.format(Number(value)) }
                    }
                },
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: item => `${item.dataset.label}: ${numberFormat.format(Number(item.raw))}`,
                            ...(stacked && !data.series.some(series => series.stack) ? {
                                footer: items => `Total: ${numberFormat.format(items.reduce((sum, item) => sum + Number(item.raw), 0))}`
                            } : {})
                        }
                    }
                }
            }
        });
        return () => chart.destroy();
    }, [data, stacked, yTitle, colors]);
    return (
        <div style={{ position: 'relative', height: '360px', width: '100%' }}>
            <canvas ref={canvasRef} role="img" aria-label={yTitle}></canvas>
        </div>
    );
};

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
