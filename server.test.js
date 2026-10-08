const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getNextTokenSequence,
  validateTokenInput,
  validateStatusInput,
  validateNotificationInput
} = require('./server');

test('token sequence uses the highest existing number', () => {
  const tokens = [
    { id: 'W-001' },
    { id: 'W-005' },
    { id: 'W-003' },
    { id: 'A-009' }
  ];

  assert.equal(getNextTokenSequence(tokens, 'W'), 6);
  assert.equal(getNextTokenSequence(tokens, 'A'), 10);
});

test('token sequence ignores malformed IDs', () => {
  assert.equal(
    getNextTokenSequence([{ id: 'W-test' }, { id: 'W-abc' }], 'W'),
    1
  );
});

test('token input validation rejects invalid requests', () => {
  assert.equal(validateTokenInput(null), 'request body must be a JSON object');
  assert.equal(validateTokenInput({ type: 'invalid', service: 'General' }), 'type must be walkin or online');
  assert.equal(validateTokenInput({ type: 'walkin', service: '' }), 'service is required');
  assert.equal(validateTokenInput({ type: 'walkin', service: 'General', channel: 'fax' }), 'channel must be browser, email, or sms');
  assert.equal(validateTokenInput({ type: 'walkin', service: ' General ', channel: 'browser' }), null);
});

test('status validation accepts supported statuses only', () => {
  assert.equal(validateStatusInput({ status: 'serving' }), null);
  assert.equal(validateStatusInput({ status: 'cancelled' }), 'invalid status');
  assert.equal(validateStatusInput({ status: 'waiting', channel: 'push' }), 'channel must be browser, email, or sms');
});

test('notification validation enforces message and channel rules', () => {
  assert.equal(validateNotificationInput({ message: 'Hello' }), null);
  assert.equal(validateNotificationInput({ message: '' }), 'message is required');
  assert.equal(validateNotificationInput({ message: 'Hello', channel: 'fax' }), 'channel must be browser, email, or sms');
  assert.equal(validateNotificationInput({ message: 'Hello', tokenId: 42 }), 'tokenId must be a string');
});
