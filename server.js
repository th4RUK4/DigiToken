const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const STORE_PATH = path.join(ROOT, 'data', 'store.json');
const clients = new Set();

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

async function readStore() {
  return JSON.parse(await fs.readFile(STORE_PATH, 'utf8'));
}

async function writeStore(store) {
  await fs.writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function broadcast(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  clients.forEach(client => client.write(message));
}

const MAX_BODY_SIZE = 64 * 1024;
const TOKEN_TYPES = new Set(['walkin', 'online']);
const NOTIFICATION_CHANNELS = new Set(['browser', 'email', 'sms']);

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_SIZE) return null;
  }
  if (!body) return {};
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function validateTokenInput(body) {
  if (!body || typeof body !== 'object') return 'request body must be a JSON object';
  if (!TOKEN_TYPES.has(body.type)) return 'type must be walkin or online';
  if (typeof body.service !== 'string' || !body.service.trim()) return 'service is required';
  if (body.service.trim().length > 100) return 'service must be 100 characters or fewer';
  if (body.channel !== undefined && !NOTIFICATION_CHANNELS.has(body.channel)) {
    return 'channel must be browser, email, or sms';
  }
  return null;
}

function validateStatusInput(body) {
  const allowedStatuses = new Set(['waiting', 'serving', 'completed', 'no-show']);
  if (!body || typeof body !== 'object') return 'request body must be a JSON object';
  if (!allowedStatuses.has(body.status)) return 'invalid status';
  if (body.channel !== undefined && !NOTIFICATION_CHANNELS.has(body.channel)) {
    return 'channel must be browser, email, or sms';
  }
  return null;
}

function validateNotificationInput(body) {
  if (!body || typeof body !== 'object') return 'request body must be a JSON object';
  if (typeof body.message !== 'string' || !body.message.trim()) return 'message is required';
  if (body.message.trim().length > 500) return 'message must be 500 characters or fewer';
  if (body.tokenId !== undefined && body.tokenId !== null && typeof body.tokenId !== 'string') {
    return 'tokenId must be a string';
  }
  if (body.channel !== undefined && !NOTIFICATION_CHANNELS.has(body.channel)) {
    return 'channel must be browser, email, or sms';
  }
  return null;
}

function notificationFrom(tokenId, message, channel = 'browser') {
  return {
    id: crypto.randomUUID(),
    tokenId,
    channel,
    message,
    status: 'delivered',
    createdAt: new Date().toISOString()
  };
}

async function createNotification(store, tokenId, message, channel) {
  const notification = notificationFrom(tokenId, message, channel);
  store.notifications.unshift(notification);
  store.notifications = store.notifications.slice(0, 100);
  await writeStore(store);
  broadcast('notification', notification);
  return notification;
}

function getNextTokenSequence(tokens, prefix) {
  return tokens.reduce((highest, token) => {
    if (!token.id.startsWith(`${prefix}-`)) return highest;

    const match = token.id.match(new RegExp(`^${prefix}-(\\d+)const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const STORE_PATH = path.join(ROOT, 'data', 'store.json');
const clients = new Set();

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

async function readStore() {
  return JSON.parse(await fs.readFile(STORE_PATH, 'utf8'));
}

async function writeStore(store) {
  await fs.writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function broadcast(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  clients.forEach(client => client.write(message));
}

const MAX_BODY_SIZE = 64 * 1024;
const TOKEN_TYPES = new Set(['walkin', 'online']);
const NOTIFICATION_CHANNELS = new Set(['browser', 'email', 'sms']);

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_SIZE) return null;
  }
  if (!body) return {};
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function validateTokenInput(body) {
  if (!body || typeof body !== 'object') return 'request body must be a JSON object';
  if (!TOKEN_TYPES.has(body.type)) return 'type must be walkin or online';
  if (typeof body.service !== 'string' || !body.service.trim()) return 'service is required';
  if (body.service.trim().length > 100) return 'service must be 100 characters or fewer';
  if (body.channel !== undefined && !NOTIFICATION_CHANNELS.has(body.channel)) {
    return 'channel must be browser, email, or sms';
  }
  return null;
}

function validateStatusInput(body) {
  const allowedStatuses = new Set(['waiting', 'serving', 'completed', 'no-show']);
  if (!body || typeof body !== 'object') return 'request body must be a JSON object';
  if (!allowedStatuses.has(body.status)) return 'invalid status';
  if (body.channel !== undefined && !NOTIFICATION_CHANNELS.has(body.channel)) {
    return 'channel must be browser, email, or sms';
  }
  return null;
}

function validateNotificationInput(body) {
  if (!body || typeof body !== 'object') return 'request body must be a JSON object';
  if (typeof body.message !== 'string' || !body.message.trim()) return 'message is required';
  if (body.message.trim().length > 500) return 'message must be 500 characters or fewer';
  if (body.tokenId !== undefined && body.tokenId !== null && typeof body.tokenId !== 'string') {
    return 'tokenId must be a string';
  }
  if (body.channel !== undefined && !NOTIFICATION_CHANNELS.has(body.channel)) {
    return 'channel must be browser, email, or sms';
  }
  return null;
}

function notificationFrom(tokenId, message, channel = 'browser') {
  return {
    id: crypto.randomUUID(),
    tokenId,
    channel,
    message,
    status: 'delivered',
    createdAt: new Date().toISOString()
  };
}

async function createNotification(store, tokenId, message, channel) {
  const notification = notificationFrom(tokenId, message, channel);
  store.notifications.unshift(notification);
  store.notifications = store.notifications.slice(0, 100);
  await writeStore(store);
  broadcast('notification', notification);
  return notification;
}

function getNextTokenSequence(tokens, prefix) {
  return tokens.reduce((highest, token) => {
    if (!token.id.startsWith(`${prefix}-`)) return highest;

    ));
    if (!match) return highest;

    return Math.max(highest, Number(match[1]));
  }, 0) + 1;
}

async function handleApi(request, response, pathname) {
  const store = await readStore();

  if (request.method === 'GET' && pathname === '/api/health') {
    return sendJson(response, 200, { ok: true, service: 'DigiToken API' });
  }

  if (request.method === 'GET' && pathname === '/api/queue') {
    return sendJson(response, 200, { tokens: store.tokens });
  }

  if (request.method === 'GET' && pathname === '/api/notifications') {
    return sendJson(response, 200, { notifications: store.notifications });
  }

  if (request.method === 'GET' && pathname === '/api/events') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    response.write('retry: 5000\n\n');
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }

  if (request.method === 'POST' && pathname === '/api/tokens') {
    const body = await readBody(request);
    const validationError = validateTokenInput(body);
    if (validationError) return sendJson(response, 400, { error: validationError });

    const prefix = body.type === 'walkin' ? 'W' : 'A';
    const sequence = getNextTokenSequence(store.tokens, prefix);
    const token = {
      id: `${prefix}-${String(sequence).padStart(3, '0')}`,
      type: body.type === 'walkin' ? 'walkin' : 'online',
      service: body.service.trim(),
      status: 'waiting',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    store.tokens.push(token);
    await writeStore(store);
    broadcast('queue-updated', { tokens: store.tokens });
    await createNotification(store, token.id, `Token ${token.id} was created and is waiting.`, body.channel);
    return sendJson(response, 201, token);
  }

  const statusMatch = pathname.match(/^\\/api\\/tokens\\/([^/]+)\\/status$/);
  if (request.method === 'PATCH' && statusMatch) {
    const body = await readBody(request);
    const validationError = validateStatusInput(body);
    if (validationError) return sendJson(response, 400, { error: validationError });

    const token = store.tokens.find(item => item.id === decodeURIComponent(statusMatch[1]));
    if (!token) return sendJson(response, 404, { error: 'token not found' });

    if (body.status === 'serving') {
      store.tokens.forEach(item => {
        if (item.status === 'serving') item.status = 'completed';
      });
    }
    token.status = body.status;
    await writeStore(store);
    broadcast('queue-updated', { tokens: store.tokens });

    const message = body.status === 'serving'
      ? `Your token ${token.id} is now being served.`
      : `Token ${token.id} status changed to ${body.status}.`;
    await createNotification(store, token.id, message, body.channel);
    return sendJson(response, 200, token);
  }

  if (request.method === 'POST' && pathname === '/api/notifications') {
    const body = await readBody(request);
    const validationError = validateNotificationInput(body);
    if (validationError) return sendJson(response, 400, { error: validationError });
    const notification = await createNotification(store, body.tokenId || null, body.message.trim(), body.channel);
    return sendJson(response, 201, notification);
  }

  sendJson(response, 404, { error: 'API route not found' });
}

async function serveStatic(response, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(ROOT, `.${requestedPath}`);
  if (!filePath.startsWith(ROOT + path.sep)) return sendJson(response, 403, { error: 'forbidden' });

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  } catch {
    sendJson(response, 404, { error: 'file not found' });
  }
}

const server = http.createServer(async (request, response) => {
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

server.listen(PORT, () => {
  console.log(`DigiToken running at http://localhost:${PORT}`);
});
