// Chart data shapes shared by the chart webviews (rendered by `components/BarChart.tsx`).

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
