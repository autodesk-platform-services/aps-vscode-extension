import * as assert from 'assert';
import * as path from 'path';
import { resolveViewerScripts, stringPropertySorter } from '../../common';

describe('stringPropertySorter', () => {
	it('sorts ascending by the given string property', () => {
		const items = [{ name: 'banana' }, { name: 'apple' }, { name: 'cherry' }];
		assert.deepStrictEqual(items.sort(stringPropertySorter('name')).map(i => i.name), ['apple', 'banana', 'cherry']);
	});

	it('treats equal values as equal (stable, no reordering forced)', () => {
		const items = [{ name: 'apple', id: 1 }, { name: 'apple', id: 2 }];
		assert.deepStrictEqual(items.sort(stringPropertySorter('name')).map(i => i.id), [1, 2]);
	});

	it('works with a numeric property too (relies on < and >)', () => {
		const items = [{ size: 30 }, { size: 10 }, { size: 20 }];
		assert.deepStrictEqual(items.sort(stringPropertySorter('size')).map(i => i.size), [10, 20, 30]);
	});
});

describe('resolveViewerScripts', () => {
	const root = path.resolve('/workspace');

	it('accepts https:// URLs as remote scripts', () => {
		const result = resolveViewerScripts(['https://example.com/ext.js']);
		assert.deepStrictEqual(result.remote.map(u => u.toString()), ['https://example.com/ext.js']);
		assert.deepStrictEqual(result.local, []);
		assert.deepStrictEqual(result.invalid, []);
	});

	it('rejects non-https URLs', () => {
		const result = resolveViewerScripts(['http://example.com/ext.js', 'file:///tmp/ext.js']);
		assert.deepStrictEqual(result.remote, []);
		assert.deepStrictEqual(result.invalid, ['http://example.com/ext.js', 'file:///tmp/ext.js']);
	});

	it('resolves relative paths against the workspace root', () => {
		const result = resolveViewerScripts(['viewer/ext.js', './other.js'], root);
		assert.deepStrictEqual(result.local, [path.join(root, 'viewer', 'ext.js'), path.join(root, 'other.js')]);
	});

	it('keeps absolute paths as they are', () => {
		const file = path.join(root, 'ext.js');
		assert.deepStrictEqual(resolveViewerScripts([file]).local, [file]);
	});

	it('rejects relative paths without a workspace, and empty entries', () => {
		const result = resolveViewerScripts(['ext.js', '  ']);
		assert.deepStrictEqual(result.local, []);
		assert.deepStrictEqual(result.invalid, ['ext.js', '  ']);
	});
});
