require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');

const legacyStorePath = path.join(__dirname, 'data', 'store.json');
const pool = new Pool(process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'digitoken',
      user: process.env.PGUSER || process.env.USER,
      password: process.env.PGPASSWORD || undefined
    });

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone text NOT NULL DEFAULT '',
    role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS tokens (
    id text PRIMARY KEY,
    type text NOT NULL CHECK (type IN ('online', 'walkin')),
    service text NOT NULL,
    status text NOT NULL CHECK (status IN ('waiting', 'called', 'serving', 'completed', 'no-show', 'cancelled')),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    user_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    called_at timestamptz,
    served_at timestamptz,
    completed_at timestamptz,
    display_time text
  );
  CREATE INDEX IF NOT EXISTS tokens_user_id_idx ON tokens(user_id);
  CREATE INDEX IF NOT EXISTS tokens_queue_idx ON tokens(status, created_at);
  CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY,
    token_id text,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    channel text NOT NULL DEFAULT 'browser',
    message text NOT NULL,
    status text NOT NULL DEFAULT 'delivered',
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS token_counters (
    prefix text PRIMARY KEY CHECK (prefix IN ('A', 'W')),
    next_number integer NOT NULL CHECK (next_number > 0)
  );
  CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_key text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );
`;

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    role: row.role,
    createdAt: row.created_at
  };
}

function mapToken(row) {
  return {
    id: row.id,
    type: row.type,
    service: row.service,
    status: row.status,
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at,
    calledAt: row.called_at,
    servedAt: row.served_at,
    completedAt: row.completed_at,
    time: row.display_time
  };
}

function mapNotification(row) {
  return {
    id: row.id,
    tokenId: row.token_id,
    userId: row.user_id,
    channel: row.channel,
    message: row.message,
    status: row.status,
    createdAt: row.created_at
  };
}

async function withTransaction(operation) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function importLegacyStore() {
  let legacy;
  try {
    legacy = JSON.parse(await fs.readFile(legacyStorePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  await withTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(548883, 1)');
    const migration = await client.query("SELECT 1 FROM schema_migrations WHERE migration_key = 'legacy_store_v1'");
    if (migration.rows.length) return;

    for (const user of legacy.users || []) {
      await client.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
        [user.id, user.email, user.passwordHash, user.firstName, user.lastName, user.phone || '', user.role || 'user', user.createdAt || new Date()]
      );
    }

    for (const token of legacy.tokens || []) {
      await client.query(
        `INSERT INTO tokens (id, type, service, status, user_id, user_name, created_at, called_at, served_at, completed_at, display_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
        [token.id, token.type || 'online', token.service || 'General Enquiry', token.status || 'waiting', token.userId || null, token.userName || null, token.createdAt || new Date(), token.calledAt || null, token.servedAt || null, token.completedAt || null, token.time || null]
      );
    }

    for (const notification of legacy.notifications || []) {
      await client.query(
        `INSERT INTO notifications (id, token_id, user_id, channel, message, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [notification.id, notification.tokenId || null, notification.userId || null, notification.channel || 'browser', notification.message, notification.status || 'delivered', notification.createdAt || new Date()]
      );
    }

    for (const [prefix, type] of [['A', 'online'], ['W', 'walkin']]) {
      const result = await client.query(
        `SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^' || $1 || '-', ''), '')::integer), 0) AS last_number
         FROM tokens WHERE type = $2`,
        [prefix, type]
      );
      const nextNumber = Number(result.rows[0].last_number) + 1;
      await client.query(
        `INSERT INTO token_counters (prefix, next_number) VALUES ($1, $2)
         ON CONFLICT (prefix) DO UPDATE SET next_number = GREATEST(token_counters.next_number, EXCLUDED.next_number)`,
        [prefix, nextNumber]
      );
    }

    await client.query("INSERT INTO schema_migrations (migration_key) VALUES ('legacy_store_v1')");
  });
}

async function initializeDatabase() {
  await pool.query(schema);
  await importLegacyStore();
}

async function getUserByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return mapUser(result.rows[0]);
}

async function getUserById(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return mapUser(result.rows[0]);
}

async function createUser(user) {
  const result = await pool.query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [user.id, user.email, user.passwordHash, user.firstName, user.lastName, user.phone || '', user.role || 'user', user.createdAt || new Date()]
  );
  return mapUser(result.rows[0]);
}

async function updatePasswordHash(id, passwordHash) {
  await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
}

async function updateProfile(id, changes) {
  const result = await pool.query(
    `UPDATE users SET first_name = $2, last_name = $3, phone = $4
     WHERE id = $1 RETURNING *`,
    [id, changes.firstName, changes.lastName, changes.phone]
  );
  return mapUser(result.rows[0]);
}

async function listTokens() {
  const result = await pool.query('SELECT * FROM tokens ORDER BY created_at, id');
  return result.rows.map(mapToken);
}

async function createToken({ type, service, userId, userName, channel = 'browser', idFactory }) {
  return withTransaction(async client => {
    const prefix = type === 'walkin' ? 'W' : 'A';
    await client.query('INSERT INTO token_counters (prefix, next_number) VALUES ($1, 1) ON CONFLICT (prefix) DO NOTHING', [prefix]);
    const counter = await client.query('SELECT next_number FROM token_counters WHERE prefix = $1 FOR UPDATE', [prefix]);
    const sequence = Number(counter.rows[0].next_number);
    await client.query('UPDATE token_counters SET next_number = $2 WHERE prefix = $1', [prefix, sequence + 1]);
    const token = idFactory({ type, service, userId, userName, sequence });
    const result = await client.query(
      `INSERT INTO tokens (id, type, service, status, user_id, user_name, created_at, called_at, served_at, completed_at, display_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [token.id, token.type, token.service, token.status, token.userId, token.userName, token.createdAt, token.calledAt, token.servedAt, token.completedAt, token.time]
    );
    const notification = await insertNotification(client, {
      tokenId: token.id,
      userId,
      channel,
      message: `Token ${token.id} was created and is waiting.`
    });
    return { token: mapToken(result.rows[0]), notification };
  });
}

async function insertNotification(client, notification) {
  const result = await client.query(
    `INSERT INTO notifications (id, token_id, user_id, channel, message, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [notification.id, notification.tokenId || null, notification.userId || null, notification.channel || 'browser', notification.message, notification.status || 'delivered', notification.createdAt || new Date()]
  );
  await client.query(
    `DELETE FROM notifications WHERE id IN (
       SELECT id FROM notifications ORDER BY created_at DESC, id DESC OFFSET 100
     )`
  );
  return mapNotification(result.rows[0]);
}

async function updateTokenStatus(tokenId, nextStatus, updateTokenStatusDomain, channel = 'browser') {
  return withTransaction(async client => {
    const rows = await client.query('SELECT * FROM tokens ORDER BY created_at, id FOR UPDATE');
    const before = rows.rows.map(mapToken);
    const after = updateTokenStatusDomain(before, tokenId, nextStatus);
    const existing = before.find(item => item.id === tokenId);
    for (const token of after) {
      const previous = before.find(item => item.id === token.id);
      if (previous.status === token.status) continue;
      await client.query(
        `UPDATE tokens SET status = $2, called_at = $3, served_at = $4, completed_at = $5 WHERE id = $1`,
        [token.id, token.status, token.calledAt || null, token.servedAt || null, token.completedAt || null]
      );
    }
    const updated = after.find(item => item.id === tokenId);
    const createdNotification = await insertNotification(client, {
      id: crypto.randomUUID(),
      tokenId,
      userId: existing.userId,
      channel,
      status: 'delivered',
      createdAt: new Date(),
      message: nextStatus === 'serving'
        ? `Your token ${tokenId} is now being served.`
        : `Token ${tokenId} status changed to ${nextStatus}.`
    });
    return { token: updated, tokens: after, notification: createdNotification };
  });
}

async function createNotification({ tokenId = null, message, channel = 'browser', userId = null }) {
  return withTransaction(async client => {
    if (tokenId) {
      const token = await client.query('SELECT user_id FROM tokens WHERE id = $1', [tokenId]);
      if (token.rows[0]) userId = token.rows[0].user_id;
    }
    return insertNotification(client, {
      id: crypto.randomUUID(), tokenId, userId, channel, message,
      status: 'delivered', createdAt: new Date()
    });
  });
}

async function listNotifications(user) {
  const result = user.role === 'admin'
    ? await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100')
    : await pool.query(
        `SELECT DISTINCT n.* FROM notifications n
         LEFT JOIN tokens t ON t.id = n.token_id
         WHERE n.user_id = $1 OR t.user_id = $1
         ORDER BY n.created_at DESC LIMIT 100`,
        [user.id]
      );
  return result.rows.map(mapNotification);
}

async function createAdminIfMissing(user) {
  await withTransaction(async client => {
    const result = await client.query('SELECT id FROM users WHERE email = $1', [user.email]);
    if (result.rows.length) {
      await client.query("UPDATE users SET role = 'admin' WHERE id = $1", [result.rows[0].id]);
      return;
    }
    await client.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, created_at)
       VALUES ($1, $2, $3, 'Admin', 'User', '', 'admin', now())`,
      [user.id, user.email, user.passwordHash]
    );
  });
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  initializeDatabase,
  getUserByEmail,
  getUserById,
  createUser,
  updatePasswordHash,
  updateProfile,
  listTokens,
  createToken,
  updateTokenStatus,
  createNotification,
  listNotifications,
  createAdminIfMissing,
  closeDatabase
};
