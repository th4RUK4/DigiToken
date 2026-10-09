const test = require('node:test');
const assert = require('node:assert/strict');
const { createEventHub } = require('./events');

function fakeClient() {
  return { messages: [], write(message) { this.messages.push(message); } };
}

test('notification events are delivered only to the owner and admins', () => {
  const hub = createEventHub();
  const owner = fakeClient();
  const anotherCustomer = fakeClient();
  const admin = fakeClient();
  hub.connect(owner, { id: 'customer-1', role: 'user' });
  hub.connect(anotherCustomer, { id: 'customer-2', role: 'user' });
  hub.connect(admin, { id: 'admin-1', role: 'admin' });

  hub.broadcast('notification', { userId: 'customer-1', message: 'Your token is ready.' });

  assert.equal(owner.messages.length, 1);
  assert.equal(anotherCustomer.messages.length, 0);
  assert.equal(admin.messages.length, 1);
});

test('queue events do not expose other customers token details', () => {
  const hub = createEventHub();
  const customer = fakeClient();
  const admin = fakeClient();
  hub.connect(customer, { id: 'customer-1', role: 'user' });
  hub.connect(admin, { id: 'admin-1', role: 'admin' });

  hub.broadcast('queue-updated', { tokens: [{ id: 'A-001', userName: 'Private Name' }] });

  assert.match(customer.messages[0], /data: \{\}/);
  assert.doesNotMatch(customer.messages[0], /Private Name/);
  assert.match(admin.messages[0], /Private Name/);
});

test('disconnected clients stop receiving events', () => {
  const hub = createEventHub();
  const client = fakeClient();
  hub.connect(client, { id: 'customer-1', role: 'user' });
  hub.disconnect(client);
  hub.broadcast('notification', { userId: 'customer-1', message: 'update' });
  assert.equal(client.messages.length, 0);
});
