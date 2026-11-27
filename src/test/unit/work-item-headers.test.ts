import * as assert from 'assert';
import { parseHeaders } from '../../webviews/work-item-headers';

describe('parseHeaders', () => {
	it('parses semicolon-separated name:value pairs and trims whitespace', () => {
		assert.deepStrictEqual(parseHeaders(' A : 1 ; B:2 '), { A: '1', B: '2' });
	});

	it('keeps colons inside header values', () => {
		assert.deepStrictEqual(parseHeaders('Referer:https://example.com:8080/x'), { Referer: 'https://example.com:8080/x' });
	});

	it('ignores empty entries, such as a trailing semicolon', () => {
		assert.deepStrictEqual(parseHeaders('A:1;'), { A: '1' });
		assert.deepStrictEqual(parseHeaders(';;'), {});
	});

	it('ignores entries without a colon or without a header name', () => {
		assert.deepStrictEqual(parseHeaders('A:1;oops;:value;B:2'), { A: '1', B: '2' });
	});

	it('allows empty header values', () => {
		assert.deepStrictEqual(parseHeaders('A:'), { A: '' });
	});

	it('returns an empty map for empty input', () => {
		assert.deepStrictEqual(parseHeaders(''), {});
	});
});
