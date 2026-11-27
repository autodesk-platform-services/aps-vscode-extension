import * as assert from 'assert';
import { isLoginCancelled } from '../../auth-provider';

describe('isLoginCancelled', () => {
	it('recognizes the cancellation raised when the user dismisses a sign-in step', () => {
		assert.strictEqual(isLoginCancelled(new Error('Login cancelled.')), true);
	});

	it('recognizes VS Code\'s own "did not consent" cancellation', () => {
		assert.strictEqual(isLoginCancelled(new Error('User did not consent to login.')), true);
	});

	it('does not treat real sign-in failures as cancellations', () => {
		assert.strictEqual(isLoginCancelled(new Error('No scopes selected.')), false);
		assert.strictEqual(isLoginCancelled(new Error('Login timed out.')), false);
	});

	it('ignores values that are not errors', () => {
		assert.strictEqual(isLoginCancelled('Login cancelled.'), false);
		assert.strictEqual(isLoginCancelled(undefined), false);
	});
});
