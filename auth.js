const crypto = require('node:crypto');
const { promisify } = require('node:util');
const bcrypt = require('bcrypt');

const scrypt = promisify(crypto.scrypt);

const SCRYPT_KEYLEN = 64;
const BCRYPT_ROUNDS = 12;

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || '',
    role: user.role
  };
}

async function hashPassword(password) {
  return bcrypt.hash(String(password), BCRYPT_ROUNDS);
}

async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (/^\$2[aby]\$/.test(stored)) {
    try {
      return await bcrypt.compare(String(password), stored);
    } catch {
      return false;
    }
  }
  if (!stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !/^[a-f0-9]{128}$/i.test(hash || '')) return false;
  const derived = await scrypt(String(password), salt, SCRYPT_KEYLEN);
  const left = Buffer.from(hash, 'hex');
  const right = Buffer.from(derived.toString('hex'), 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function isBcryptHash(stored) {
  return typeof stored === 'string' && /^\$2[aby]\$/.test(stored);
}

function createSessionStore() {
  const sessions = new Map();

  return {
    create(userId) {
      const id = crypto.randomBytes(24).toString('hex');
      sessions.set(id, { userId, createdAt: Date.now() });
      return id;
    },
    get(id) {
      if (!id) return null;
      return sessions.get(id) || null;
    },
    destroy(id) {
      if (id) sessions.delete(id);
    }
  };
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function sessionCookieHeader(sessionId, { maxAgeSeconds = 60 * 60 * 24 * 7 } = {}) {
  const parts = [
    `digitoken_session=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (maxAgeSeconds) parts.push(`Max-Age=${maxAgeSeconds}`);
  return parts.join('; ');
}

function clearSessionCookieHeader() {
  return 'digitoken_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

module.exports = {
  publicUser,
  hashPassword,
  verifyPassword,
  isBcryptHash,
  createSessionStore,
  parseCookies,
  sessionCookieHeader,
  clearSessionCookieHeader
};
