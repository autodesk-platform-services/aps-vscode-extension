import * as assert from 'assert';
import { buildContractYearsData, buildMonthlyUsageData, getContractYears } from '../../webviews/token-flex-chart-data';

const summary = [
	{ usageMonth: '2015-02-01', contractYear: 1, usageCategory: 'PRODUCT_CONSUMPTION', uniqueUsers: 10, tokensConsumed: 100 },
	{ usageMonth: '2015-01-01', contractYear: 1, usageCategory: 'CLOUD_CONSUMPTION', uniqueUsers: 2, tokensConsumed: 5 },
	{ usageMonth: '2015-01-01', contractYear: 1, usageCategory: 'PRODUCT_CONSUMPTION', uniqueUsers: 8, tokensConsumed: 80 },
	{ usageMonth: '2016-05-01', contractYear: 2, usageCategory: 'CLOUD_CONSUMPTION', uniqueUsers: 3, tokensConsumed: 7 }
];

describe('Token Flex chart data', () => {
	it('pivots monthly usage into one series per usage category, filling gaps with zeros', () => {
		assert.deepStrictEqual(buildMonthlyUsageData(summary, 'tokensConsumed'), {
			labels: ['2015-01', '2015-02', '2016-05'],
			series: [
				{ label: 'CLOUD_CONSUMPTION', data: [5, 0, 7] },
				{ label: 'PRODUCT_CONSUMPTION', data: [80, 100, 0] }
			]
		});
	});

	it('limits monthly usage to one contract year and supports the unique users metric', () => {
		assert.deepStrictEqual(buildMonthlyUsageData(summary, 'uniqueUsers', 2), {
			labels: ['2016-05'],
			series: [{ label: 'CLOUD_CONSUMPTION', data: [3] }]
		});
	});

	it('lists the contract years present in the summary', () => {
		assert.deepStrictEqual(getContractYears(summary), [1, 2]);
	});

	it('stacks consumed and remaining tokens per contract year, with multi-year tokens in their own stack', () => {
		const data = buildContractYearsData([
			{ year: 2, startDate: '', endDate: '', provisionedTokens: 10, consumedTokens: 12, remainingTokens: -2, multiyearConsumedTokens: 0 },
			{ year: 1, startDate: '', endDate: '', provisionedTokens: 10, consumedTokens: 4, remainingTokens: 6, multiyearConsumedTokens: 3 }
		]);
		assert.deepStrictEqual(data, {
			labels: ['Year 1', 'Year 2'],
			series: [
				{ label: 'Consumed', data: [4, 12], stack: 'annual' },
				{ label: 'Remaining', data: [6, 0], stack: 'annual' },
				{ label: 'Multi-year consumed', data: [3, 0], stack: 'multiyear' }
			]
		});
	});

	it('omits the multi-year series when no multi-year tokens were consumed', () => {
		const data = buildContractYearsData([{ year: 1, startDate: '', endDate: '', provisionedTokens: 10, consumedTokens: 4, remainingTokens: 6 }]);
		assert.deepStrictEqual(data.series.map(series => series.label), ['Consumed', 'Remaining']);
	});
});
