const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createServer } = require('./server');
const { hashPassword } = require('./auth');
const { createTokenRecord } = require('./queue');

function createFakeDatabase(users) {
  const tokens = [];
  const notifications = [];

  return {
    async getUserByEmail(email) {
      return [...users.values()].find(user => user.email === email) || null;
    },
    async getUserById(id) {
      return users.get(id) || null;
    },
    async createUser(user) {
      if ([...users.values()].some(existing => existing.email === user.email)) {
        const error = new Error('email already exists');
        error.code = '23505';
        throw error;
      }
      users.set(user.id, user);
      return user;
    },
    async updatePasswordHash(id, passwordHash) {
      users.get(id).passwordHash = passwordHash;
    },
    async updateProfile(id, changes) {
      Object.assign(users.get(id), changes);
      return users.get(id);
    },
    async listTokens() {
      return [...tokens];
    },
    async createToken({ type, service, userId, userName, channel, idFactory }) {
      const sequence = tokens.filter(token => token.type === type).length + 1;
      const token = idFactory({ type, service, userId, userName, sequence });
      tokens.push(token);
      const notification = {
        id: crypto.randomUUID(), tokenId: token.id, userId,
        channel, message: `Token ${token.id} was created and is waiting.`, status: 'delivered'
      };
      notifications.push(notification);
      return { token, notification };
    },
    async listNotifications(user) {
      return notifications.filter(notification => user.role === 'admin' || notification.userId === user.id);
    },
    async createNotification(notification) {
      const created = { id: crypto.randomUUID(), status: 'delivered', ...notification };
      notifications.push(created);
      return created;
    },
    async updateTokenStatus() {
      throw new Error('not used in this user-flow test');
    }
  };
}

test('customer signup without names still works and can log in', async t => {
  const admin = {
    id: crypto.randomUUID(), email: 'admin@example.test', firstName: 'Site', lastName: 'Admin',
    phone: '', role: 'admin', passwordHash: await hashPassword('admin-pass-123')
  };
  const users = new Map([[admin.id, admin]]);
  const server = createServer({ database: createFakeDatabase(users) });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { cookie, ...options } = {}) {
    const headers = { ...(options.headers || {}) };
    if (cookie) headers.Cookie = cookie;
    if (options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();
    const setCookie = response.headers.get('set-cookie');
    return { response, data, cookie: setCookie?.split(';', 1)[0] };
  }

  const signup = await request('/api/auth/signup', {
    method: 'POST',
    body: { email: 'optional-name@example.test', password: 'customer-pass-123' }
  });
  assert.equal(signup.response.status, 201);
  assert.equal(signup.data.user.email, 'optional-name@example.test');
  assert.equal(signup.data.user.firstName, '');
  assert.equal(signup.data.user.lastName, '');

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'optional-name@example.test', password: 'customer-pass-123' }
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.data.user.email, 'optional-name@example.test');
  assert.ok(login.cookie);

  const me = await request('/api/auth/me', { cookie: login.cookie });
  assert.equal(me.response.status, 200);
  assert.equal(me.data.user.email, 'optional-name@example.test');
  assert.equal(me.data.user.firstName, '');
  assert.equal(me.data.user.lastName, '');
});

test('customer signup, login, booking, queue, notifications, profile, and logout flow', async t => {
  const admin = {
    id: crypto.randomUUID(), email: 'admin@example.test', firstName: 'Site', lastName: 'Admin',
    phone: '', role: 'admin', passwordHash: await hashPassword('admin-pass-123')
  };
  const users = new Map([[admin.id, admin]]);
  const server = createServer({ database: createFakeDatabase(users) });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { cookie, ...options } = {}) {
    const headers = { ...(options.headers || {}) };
    if (cookie) headers.Cookie = cookie;
    if (options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();
    const setCookie = response.headers.get('set-cookie');
    return { response, data, cookie: setCookie?.split(';', 1)[0] };
  }

  const landing = await fetch(baseUrl);
  assert.equal(landing.status, 200);
  assert.match(await landing.text(), /href="auth\.html"/);

  const denied = await request('/api/queue');
  assert.equal(denied.response.status, 401);

  const signup = await request('/api/auth/signup', {
    method: 'POST',
    body: { firstName: 'Ada', lastName: 'Lovelace', email: ' ADA@example.test ', password: 'customer-pass-123' }
  });
  assert.equal(signup.response.status, 201);
  assert.equal(signup.data.user.email, 'ada@example.test');
  assert.equal(signup.data.user.firstName, 'Ada');
  assert.equal(signup.data.user.lastName, 'Lovelace');
  assert.equal(signup.data.user.role, 'user');
  assert.equal(signup.cookie, undefined);
  assert.equal(signup.data.user.passwordHash, undefined);

  const noSignupSession = await request('/api/auth/me');
  assert.equal(noSignupSession.response.status, 401);

  const login = await request('/api/auth/login', {
    method: 'POST', body: { email: 'ada@example.test', password: 'customer-pass-123' }
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.data.user.role, 'user');
  assert.ok(login.cookie);

  const me = await request('/api/auth/me', { cookie: login.cookie });
  assert.equal(me.response.status, 200);
  assert.equal(me.data.user.firstName, 'Ada');
  assert.equal(me.data.user.lastName, 'Lovelace');
  assert.equal(me.data.user.email, 'ada@example.test');

  const booking = await request('/api/tokens', {
    method: 'POST', cookie: login.cookie,
    body: { type: 'online', service: 'Banking', channel: 'browser' }
  });
  assert.equal(booking.response.status, 201);
  assert.equal(booking.data.id, 'A-001');
  assert.equal(booking.data.position, 1);

  const walkIn = await request('/api/tokens', {
    method: 'POST', cookie: login.cookie,
    body: { type: 'walkin', service: 'General Enquiry', channel: 'browser' }
  });
  assert.equal(walkIn.response.status, 201);
  assert.equal(walkIn.data.id, 'W-001');

  const queue = await request('/api/queue', { cookie: login.cookie });
  assert.equal(queue.response.status, 200);
  assert.deepEqual(queue.data.tokens, []);
  assert.deepEqual(queue.data.mine.map(token => token.id), ['A-001', 'W-001']);

  const history = await request('/api/notifications', { cookie: login.cookie });
  assert.equal(history.response.status, 200);
  assert.equal(history.data.notifications.length, 2);
  assert.match(history.data.notifications[0].message, /A-001/);

  const profile = await request('/api/auth/profile', {
    method: 'PATCH', cookie: login.cookie,
    body: { firstName: 'Augusta', phone: '555-0100' }
  });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.data.user.firstName, 'Augusta');
  assert.equal(profile.data.user.phone, '555-0100');
  const refreshedProfile = await request('/api/auth/me', { cookie: login.cookie });
  assert.equal(refreshedProfile.data.user.firstName, 'Augusta');
  assert.equal(refreshedProfile.data.user.lastName, 'Lovelace');

  const logout = await request('/api/auth/logout', { method: 'POST', cookie: login.cookie, body: {} });
  assert.equal(logout.response.status, 200);
  assert.match(logout.response.headers.get('set-cookie'), /Max-Age=0/);
  const afterLogout = await request('/api/auth/me', { cookie: login.cookie });
  assert.equal(afterLogout.response.status, 401);

  const loginAgain = await request('/api/auth/login', {
    method: 'POST', body: { email: 'ada@example.test', password: 'customer-pass-123' }
  });
  assert.equal(loginAgain.response.status, 200);
  assert.equal(loginAgain.data.user.role, 'user');
  assert.ok(loginAgain.cookie);

  const wrongPassword = await request('/api/auth/login', {
    method: 'POST', body: { email: 'ada@example.test', password: 'incorrect-pass' }
  });
  assert.equal(wrongPassword.response.status, 401);

  const adminLogin = await request('/api/auth/login', {
    method: 'POST', body: { email: admin.email, password: 'admin-pass-123' }
  });
  assert.equal(adminLogin.response.status, 200);
  assert.equal(adminLogin.data.user.role, 'admin');
});
