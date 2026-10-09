const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
require('dotenv').config();
let db = require('./db');
const { createEventHub } = require('./events');
const {
  createTokenRecord,
  getCurrentServingToken,
  updateTokenStatus,
  estimateWaitMinutes,
  queuePosition
} = require('./queue');
const {
  publicUser,
  hashPassword,
  verifyPassword,
  isBcryptHash,
  createSessionStore,
  parseCookies,
  sessionCookieHeader,
  clearSessionCookieHeader
} = require('./auth');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const SESSION_COOKIE = 'digitoken_session';
let eventHub = createEventHub();
let sessions = createSessionStore();

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

const broadcast = (event, payload) => eventHub.broadcast(event, payload);

async function readBody(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function getSessionUser(request) {
  const cookies = parseCookies(request.headers.cookie || '');
  const session = sessions.get(cookies[SESSION_COOKIE]);
  if (!session) return null;
  return db.getUserById(session.userId);
}

async function requireUser(request, response) {
  const user = await getSessionUser(request);
  if (!user) {
    sendJson(response, 401, { error: 'authentication required' });
    return null;
  }
  return user;
}

async function requireAdmin(request, response) {
  const user = await requireUser(request, response);
  if (!user) return null;
  if (user.role !== 'admin') {
    sendJson(response, 403, { error: 'admin role required' });
    return null;
  }
  return user;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateSignup(body) {
  if (!body || typeof body !== 'object') return 'invalid JSON body';
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  if (!email || !email.includes('@')) return 'valid email is required';
  if (password.length < 6) return 'password must be at least 6 characters';
  return null;
}

async function seedAdminUser() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL || 'admin@digitoken.local');
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  await db.createAdminIfMissing({
    id: crypto.randomUUID(),
    email,
    passwordHash: await hashPassword(password)
  });
}

async function handleApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/health') {
    return sendJson(response, 200, { ok: true, service: 'DigiToken API' });
  }

  if (request.method === 'GET' && pathname === '/api/public/queue') {
    const tokens = await db.listTokens();
    const serving = getCurrentServingToken(tokens);
    const upNext = tokens
      .filter(token => token.status === 'waiting' || token.status === 'called')
      .slice(0, 5)
      .map((token, index) => ({
        id: token.id,
        status: token.status,
        waitMinutes: estimateWaitMinutes(tokens, token.id) || index * 5
      }));
    return sendJson(response, 200, {
      nowServing: serving ? { id: serving.id, service: serving.service } : null,
      upNext
    }, { 'Cache-Control': 'no-store' });
  }

  if (request.method === 'POST' && pathname === '/api/auth/signup') {
    const body = await readBody(request);
    const error = validateSignup(body);
    if (error) return sendJson(response, 400, { error });

    try {
      const user = await db.createUser({
        id: crypto.randomUUID(),
        email: normalizeEmail(body.email),
        passwordHash: await hashPassword(body.password),
        firstName: String(body.firstName || '').trim(),
        lastName: String(body.lastName || '').trim(),
        phone: String(body.phone || '').trim(),
        role: 'user',
        createdAt: new Date().toISOString()
      });
      return sendJson(response, 201, { user: publicUser(user) });
    } catch (error) {
      if (error.code === '23505') error.status = 409;
      return sendJson(response, error.status || 500, { error: error.message || 'signup failed' });
    }
  }

  if (request.method === 'POST' && pathname === '/api/auth/login') {
    const body = await readBody(request);
    if (!body || !body.email || !body.password) {
      return sendJson(response, 400, { error: 'email and password are required' });
    }

    const user = await db.getUserByEmail(normalizeEmail(body.email));
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return sendJson(response, 401, { error: 'invalid email or password' });
    }

    if (!isBcryptHash(user.passwordHash)) {
      user.passwordHash = await hashPassword(body.password);
      await db.updatePasswordHash(user.id, user.passwordHash);
    }

    const sessionId = sessions.create(user.id);
    return sendJson(response, 200, { user: publicUser(user) }, {
      'Set-Cookie': sessionCookieHeader(sessionId)
    });
  }

  if (request.method === 'POST' && pathname === '/api/auth/logout') {
    const cookies = parseCookies(request.headers.cookie || '');
    sessions.destroy(cookies[SESSION_COOKIE]);
    return sendJson(response, 200, { ok: true }, {
      'Set-Cookie': clearSessionCookieHeader()
    });
  }

  if (request.method === 'GET' && pathname === '/api/auth/me') {
    const user = await getSessionUser(request);
    if (!user) return sendJson(response, 401, { error: 'authentication required' });
    return sendJson(response, 200, { user: publicUser(user) });
  }

  if (request.method === 'PATCH' && pathname === '/api/auth/profile') {
    const body = await readBody(request);
    if (!body) return sendJson(response, 400, { error: 'invalid JSON body' });

    const current = await requireUser(request, response);
    if (!current) return;

    try {
      const changes = {
        firstName: body.firstName === undefined ? current.firstName : String(body.firstName).trim(),
        lastName: body.lastName === undefined ? current.lastName : String(body.lastName).trim(),
        phone: body.phone === undefined ? current.phone : String(body.phone).trim()
      };
      if (!changes.firstName && !changes.lastName) {
        return sendJson(response, 400, { error: 'enter at least a first or last name' });
      }
      const user = await db.updateProfile(current.id, changes);

      return sendJson(response, 200, { user: publicUser(user) });
    } catch (error) {
      return sendJson(response, error.status || 500, { error: error.message || 'profile update failed' });
    }
  }

  if (request.method === 'GET' && pathname === '/api/queue') {
    const user = await requireUser(request, response);
    if (!user) return;

    const tokens = await db.listTokens();
    const nowServing = getCurrentServingToken(tokens);
    const payload = {
      tokens: user.role === 'admin' ? tokens : [],
      nowServing,
      mine: tokens.filter(token => token.userId === user.id)
    };

    if (user.role !== 'admin') {
      payload.mine = payload.mine.map(token => ({
        ...token,
        position: queuePosition(tokens, token.id),
        waitMinutes: estimateWaitMinutes(tokens, token.id)
      }));
    }

    return sendJson(response, 200, payload);
  }

  if (request.method === 'GET' && pathname === '/api/notifications') {
    const user = await requireUser(request, response);
    if (!user) return;
    const notifications = await db.listNotifications(user);

    return sendJson(response, 200, { notifications });
  }

  if (request.method === 'GET' && pathname === '/api/events') {
    const user = await requireUser(request, response);
    if (!user) return;

    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    response.write('retry: 5000\n\n');
    eventHub.connect(response, user);
    request.on('close', () => eventHub.disconnect(response));
    return;
  }

  if (request.method === 'POST' && pathname === '/api/tokens') {
    const body = await readBody(request);
    if (!body || !body.service) return sendJson(response, 400, { error: 'service is required' });

    const user = await requireUser(request, response);
    if (!user) return;

    try {
      const created = await db.createToken({
          type: body.type === 'walkin' ? 'walkin' : 'online',
          service: String(body.service).trim(),
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`.trim(),
          channel: body.channel || 'browser',
          idFactory: input => createTokenRecord([], input)
      });
      const tokens = await db.listTokens();
      broadcast('notification', created.notification);
      broadcast('queue-updated', { tokens });

      return sendJson(response, 201, {
        ...created.token,
        position: queuePosition(tokens, created.token.id),
        waitMinutes: estimateWaitMinutes(tokens, created.token.id)
      });
    } catch (error) {
      return sendJson(response, 500, { error: error.message || 'unable to create token' });
    }
  }

  const statusMatch = pathname.match(/^\/api\/tokens\/([^/]+)\/status$/);
  if (request.method === 'PATCH' && statusMatch) {
    const body = await readBody(request);
    if (!body || !['waiting', 'called', 'serving', 'completed', 'no-show', 'cancelled'].includes(body.status)) {
      return sendJson(response, 400, { error: 'invalid status' });
    }

    const admin = await requireAdmin(request, response);
    if (!admin) return;

    try {
      const tokenId = decodeURIComponent(statusMatch[1]);
      const updated = await db.updateTokenStatus(tokenId, body.status, updateTokenStatus, body.channel || 'browser');
      const tokens = await db.listTokens();
      broadcast('notification', updated.notification);
      broadcast('queue-updated', { tokens });
      return sendJson(response, 200, updated.token);
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && pathname === '/api/notifications') {
    const body = await readBody(request);
    if (!body || !body.message) return sendJson(response, 400, { error: 'message is required' });

    const admin = await requireAdmin(request, response);
    if (!admin) return;

    try {
      const notification = await db.createNotification({
        tokenId: body.tokenId || null,
        message: String(body.message),
        channel: body.channel || 'browser',
        userId: body.userId || null
      });
      broadcast('notification', notification);
      return sendJson(response, 201, notification);
    } catch (error) {
      return sendJson(response, 500, { error: error.message || 'unable to create notification' });
    }
  }

  sendJson(response, 404, { error: 'API route not found' });
}

async function serveStatic(response, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(ROOT, `.${requestedPath}`);
  if (!filePath.startsWith(ROOT + path.sep)) return sendJson(response, 403, { error: 'forbidden' });
  const relativeParts = path.relative(ROOT, filePath).split(path.sep);
  if (relativeParts.some(part => part.startsWith('.')) || relativeParts.includes('node_modules') || relativeParts[0] === 'data') {
    return sendJson(response, 404, { error: 'file not found' });
  }

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  } catch {
    sendJson(response, 404, { error: 'file not found' });
  }
}

function createServer({ database = db } = {}) {
  db = database;
  eventHub = createEventHub();
  sessions = createSessionStore();

  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    try {
      if (requestUrl.pathname.startsWith('/api/')) {
        await handleApi(request, response, requestUrl.pathname);
      } else {
        await serveStatic(response, requestUrl.pathname);
      }
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { error: 'internal server error' });
    }
  });
}

if (require.main === module) {
  db.initializeDatabase()
    .then(seedAdminUser)
    .then(() => {
      const server = createServer();
      server.listen(PORT, () => {
        console.log(`DigiToken running at http://localhost:${PORT}`);
        console.log(`Admin account: ${process.env.ADMIN_EMAIL || 'admin@digitoken.local'}`);
      });
    })
    .catch(error => {
      console.error('Failed to initialize PostgreSQL or seed admin user', error);
      process.exit(1);
    });
}

module.exports = { createServer };
