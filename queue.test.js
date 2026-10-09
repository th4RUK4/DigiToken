const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTokenRecord,
  getNextWaitingToken,
  updateTokenStatus,
  getCurrentServingToken,
} = require('./queue');

test('createTokenRecord creates a walk-in token with the next sequence number', () => {
  const tokens = [
    { id: 'W-001', type: 'walkin', service: 'General', status: 'waiting' },
    { id: 'W-002', type: 'walkin', service: 'General', status: 'completed' },
  ];

  const next = createTokenRecord(tokens, { type: 'walkin', service: 'General' });

  assert.equal(next.id, 'W-003');
  assert.equal(next.status, 'waiting');
});

test('createTokenRecord creates an online token with the next sequence number', () => {
  const tokens = [
    { id: 'A-014', type: 'online', service: 'Bank Service', status: 'serving' },
    { id: 'A-015', type: 'online', service: 'Bank Service', status: 'waiting' },
  ];

  const next = createTokenRecord(tokens, { type: 'online', service: 'Bank Service' });

  assert.equal(next.id, 'A-016');
  assert.equal(next.type, 'online');
});

test('getNextWaitingToken returns the oldest waiting token', () => {
  const tokens = [
    { id: 'A-014', type: 'online', service: 'Bank Service', status: 'serving' },
    { id: 'W-005', type: 'walkin', service: 'General', status: 'waiting' },
    { id: 'A-015', type: 'online', service: 'Bank Service', status: 'waiting' },
  ];

  const next = getNextWaitingToken(tokens);

  assert.equal(next.id, 'W-005');
});

test('updateTokenStatus serving marks the current active token as completed', () => {
  const tokens = [
    { id: 'A-014', type: 'online', service: 'Bank Service', status: 'serving' },
    { id: 'W-005', type: 'walkin', service: 'General', status: 'waiting' },
  ];

  const updated = updateTokenStatus(tokens, 'W-005', 'serving');

  assert.equal(updated[0].status, 'completed');
  assert.equal(updated[1].status, 'serving');
});

test('updateTokenStatus rejects invalid status transitions', () => {
  const tokens = [
    { id: 'A-014', type: 'online', service: 'Bank Service', status: 'waiting' },
  ];

  assert.throws(() => {
    updateTokenStatus(tokens, 'A-014', 'completed');
  }, /invalid status transition/i);
});

test('getCurrentServingToken returns the currently serving token', () => {
  const tokens = [
    { id: 'A-014', type: 'online', service: 'Bank Service', status: 'serving' },
    { id: 'W-005', type: 'walkin', service: 'General', status: 'waiting' },
  ];

  const current = getCurrentServingToken(tokens);

  assert.equal(current.id, 'A-014');
});
