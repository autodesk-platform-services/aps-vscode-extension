import * as React from 'react';
import { BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip } from 'chart.js';
import { IChartData } from '../chart-data';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

/** VS Code theme colors meant for charts, in the order series get them. */
const SERIES_COLOR_VARIABLES = ['--vscode-charts-blue', '--vscode-charts-orange', '--vscode-charts-green', '--vscode-charts-purple', '--vscode-charts-red', '--vscode-charts-yellow'];
const FALLBACK_COLORS = ['#3794ff', '#d18616', '#89d185', '#b180d7', '#f14c4c', '#cca700'];

export interface IThemeColors {
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
export function useThemeColors(): IThemeColors {
    const [colors, setColors] = React.useState(readThemeColors);
    React.useEffect(() => {
        const observer = new MutationObserver(() => setColors(readThemeColors()));
        observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-vscode-theme-kind'] });
        return () => observer.disconnect();
    }, []);
    return colors;
}

export const numberFormat = new Intl.NumberFormat();

export interface IBarChartProps {
    data: IChartData;
    stacked: boolean;
    yTitle: string;
    colors: IThemeColors;
}

/** Bar chart (Chart.js) styled with the current VS Code theme colors. */
export const BarChart = ({ data, stacked, yTitle, colors }: IBarChartProps) => {
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
