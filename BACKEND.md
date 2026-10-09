# DigiToken backend

## Run locally

From the `DigiToken` directory:

```sh
npm start
```

Open <http://localhost:3000/>. Auth is required for customer and admin pages.

Configure a local PostgreSQL database in `.env` using `DATABASE_URL`, then set the seeded admin credentials:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

At startup, the app creates the PostgreSQL schema and imports legacy rows from `data/store.json` idempotently. Passwords are hashed with bcrypt. Existing scrypt hashes are verified for compatibility and upgraded after successful login.

## Auth

Sessions use an httpOnly cookie named `digitoken_session`.

- `POST /api/auth/signup` — `{ firstName, lastName, email, password, phone? }` → sets session, role `user`
- `POST /api/auth/login` — `{ email, password }` → sets session; the stored account role determines the destination and authorization level
- `POST /api/auth/logout` — clears session
- `GET /api/auth/me` — current user
- `PATCH /api/auth/profile` — `{ firstName?, lastName?, phone? }`

Passwords are hashed with bcrypt (see `auth.js`). Sessions use httpOnly cookies and are held in the running server process.

## Queue API

All of these require a valid session unless noted.

- `GET /api/health` — public health check
- `GET /api/public/queue` — public display data only (current token and up to five upcoming token IDs/statuses)
- `GET /api/queue` — full queue plus `mine` (caller’s tokens with `position` / `waitMinutes` for non-admins) and `nowServing`
- `POST /api/tokens` — create a token for the logged-in user (`type`, `service`, optional `channel`)
- `PATCH /api/tokens/:id/status` — **admin only**; status: `waiting`, `called`, `serving`, `completed`, `no-show`, `cancelled`
- `GET /api/notifications` — caller’s notifications (all for admin)
- `POST /api/notifications` — **admin only**
- `GET /api/events` — SSE stream for `queue-updated` and `notification`

Users, tokens, notifications, and token counters are stored in PostgreSQL. `data/store.json` is retained as a one-way import source for legacy data.

Browser notifications are delivered through the live event stream. Email, WhatsApp, SMS, or push-provider delivery requires provider credentials.
