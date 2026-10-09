const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const {
  hashPassword,
  verifyPassword,
  isBcryptHash,
  createSessionStore,
  parseCookies,
  publicUser
} = require('./auth');

const { setActiveAuthTab } = require('./assets/js/auth-ui');

const {
  createTokenRecord,
  estimateWaitMinutes,
  queuePosition
} = require('./queue');

test('hashPassword and verifyPassword round-trip', async () => {
  const hash = await hashPassword('secret123');
  assert.equal(isBcryptHash(hash), true);
  assert.equal(await verifyPassword('secret123', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
});

test('verifyPassword accepts legacy scrypt hashes for login migration', async () => {
  const scrypt = promisify(crypto.scrypt);
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt('legacy-password', salt, 64);
  const legacyHash = `${salt}:${hash.toString('hex')}`;

  assert.equal(isBcryptHash(legacyHash), false);
  assert.equal(await verifyPassword('legacy-password', legacyHash), true);
  assert.equal(await verifyPassword('wrong', legacyHash), false);
});

test('session store create get destroy', () => {
  const sessions = createSessionStore();
  const id = sessions.create('user-1');
  assert.equal(sessions.get(id).userId, 'user-1');
  sessions.destroy(id);
  assert.equal(sessions.get(id), null);
});

test('parseCookies reads session cookie', () => {
  const cookies = parseCookies('digitoken_session=abc%20123; other=1');
  assert.equal(cookies.digitoken_session, 'abc 123');
  assert.equal(cookies.other, '1');
});

test('publicUser omits password hash', () => {
  const user = publicUser({
    id: '1',
    email: 'a@b.com',
    firstName: 'A',
    lastName: 'B',
    phone: '',
    role: 'user',
    passwordHash: 'secret'
  });
  assert.equal(user.passwordHash, undefined);
  assert.equal(user.email, 'a@b.com');
});

test('setActiveAuthTab switches the login and sign up panels', () => {
  const tabs = [
    { dataset: { tab: 'login' }, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, tabIndex: 0, classList: { add: () => {}, remove: () => {} } },
    { dataset: { tab: 'signup' }, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, tabIndex: -1, classList: { add: () => {}, remove: () => {} } }
  ];

  const sections = {
    login: { hidden: false, classList: { add: () => {}, remove: () => {} } },
    signup: { hidden: true, classList: { add: () => {}, remove: () => {} } }
  };

  const applied = [];
  tabs[0].classList.add = value => applied.push(['tab', 'login', value]);
  tabs[0].classList.remove = value => applied.push(['tab', 'login-remove', value]);
  tabs[1].classList.add = value => applied.push(['tab', 'signup', value]);
  tabs[1].classList.remove = value => applied.push(['tab', 'signup-remove', value]);
  sections.login.classList.add = value => applied.push(['section', 'login', value]);
  sections.login.classList.remove = value => applied.push(['section', 'login-remove', value]);
  sections.signup.classList.add = value => applied.push(['section', 'signup', value]);
  sections.signup.classList.remove = value => applied.push(['section', 'signup-remove', value]);

  setActiveAuthTab('signup', tabs, sections);

  assert.equal(applied.some(item => item[0] === 'tab' && item[1] === 'signup' && item[2] === 'active'), true);
  assert.equal(applied.some(item => item[0] === 'section' && item[1] === 'signup' && item[2] === 'active'), true);
  assert.equal(applied.some(item => item[0] === 'section' && item[1] === 'login-remove' && item[2] === 'active'), true);
  assert.equal(tabs[0].attributes['aria-selected'], 'false');
  assert.equal(tabs[1].attributes['aria-selected'], 'true');
  assert.equal(tabs[0].tabIndex, -1);
  assert.equal(tabs[1].tabIndex, 0);
  assert.equal(sections.login.hidden, true);
  assert.equal(sections.signup.hidden, false);
});

test('createTokenRecord attaches user ownership', () => {
  const token = createTokenRecord([], {
    type: 'online',
    service: 'Banking',
    userId: 'u1',
    userName: 'Ada Lovelace'
  });
  assert.equal(token.userId, 'u1');
  assert.equal(token.userName, 'Ada Lovelace');
});

test('queuePosition and estimateWaitMinutes for waiting token', () => {
  const tokens = [
    { id: 'A-001', status: 'serving', createdAt: '2026-01-01T10:00:00.000Z' },
    { id: 'A-002', status: 'waiting', createdAt: '2026-01-01T10:01:00.000Z' },
    { id: 'A-003', status: 'waiting', createdAt: '2026-01-01T10:02:00.000Z' }
  ];
  assert.equal(queuePosition(tokens, 'A-003'), 2);
  assert.equal(estimateWaitMinutes(tokens, 'A-003', 5), 10);
  assert.equal(estimateWaitMinutes(tokens, 'A-001', 5), 0);
});
