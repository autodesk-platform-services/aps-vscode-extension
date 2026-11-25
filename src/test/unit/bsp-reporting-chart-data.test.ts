import * as assert from 'assert';
import { buildQueryChartData, getDefaultChartOptions, getQueryColumns, MAX_SERIES } from '../../webviews/bsp-reporting-chart-data';

const columns = ['usageMonth', 'productName', 'uniqueUsers', 'totalTokens'];
const rows = [
	['2026-02-01', 'Maya', 3, '30'],
	['2026-01-01', 'AutoCAD', 5, 50],
	['2026-01-01', 'Maya', 2, 20],
	['2026-01-01', 'AutoCAD', 1, 10],
	['2026-03-01', 'Revit', 7, null]
];

describe('Business Success Plan Reporting chart data', () => {
	it('splits query columns into categories and numeric metrics', () => {
		assert.deepStrictEqual(getQueryColumns(columns, rows), {
			categories: ['usageMonth', 'productName'],
			metrics: ['uniqueUsers', 'totalTokens']
		});
	});

	it('defaults to time on the x-axis and the next category as series', () => {
		assert.deepStrictEqual(getDefaultChartOptions({ categories: ['productName', 'usageMonth'], metrics: ['uniqueUsers'] }),
			{ xColumn: 'usageMonth', seriesColumn: 'productName', metricColumn: 'uniqueUsers' });
		assert.strictEqual(getDefaultChartOptions({ categories: ['productName'], metrics: [] }), undefined);
	});

	it('pivots rows into series, summing duplicates, with dates ascending and series by total', () => {
		assert.deepStrictEqual(buildQueryChartData(columns, rows, { xColumn: 'usageMonth', seriesColumn: 'productName', metricColumn: 'uniqueUsers' }), {
			labels: ['2026-01-01', '2026-02-01', '2026-03-01'],
			series: [
				{ label: 'Revit', data: [0, 0, 7] },
				{ label: 'AutoCAD', data: [6, 0, 0] },
				{ label: 'Maya', data: [2, 3, 0] }
			],
			omittedLabels: 0,
			omittedSeries: 0
		});
	});

	it('sorts non-date labels by total and uses a single series without a series column', () => {
		assert.deepStrictEqual(buildQueryChartData(columns, rows, { xColumn: 'productName', metricColumn: 'totalTokens' }), {
			labels: ['AutoCAD', 'Maya', 'Revit'],
			series: [{ label: 'totalTokens', data: [60, 50, 0] }],
			omittedLabels: 0,
			omittedSeries: 0
		});
	});

	it('charts every metric of the first row when there is nothing to group by', () => {
		assert.deepStrictEqual(buildQueryChartData(['uniqueUsers', 'uniqueProducts'], [[12, 4]], { metricColumn: 'uniqueUsers' }), {
			labels: ['uniqueUsers', 'uniqueProducts'],
			series: [{ label: 'Value', data: [12, 4] }],
			omittedLabels: 0,
			omittedSeries: 0
		});
	});

	it('keeps only the largest series', () => {
		const many = Array.from({ length: MAX_SERIES + 2 }, (_, i) => ['2026-01-01', `Product ${i}`, i + 1]);
		const data = buildQueryChartData(['usageMonth', 'productName', 'uniqueUsers'], many, { xColumn: 'usageMonth', seriesColumn: 'productName', metricColumn: 'uniqueUsers' });
		assert.strictEqual(data.series.length, MAX_SERIES);
		assert.strictEqual(data.series[0].label, `Product ${MAX_SERIES + 1}`);
		assert.strictEqual(data.omittedSeries, 2);
	});
});
