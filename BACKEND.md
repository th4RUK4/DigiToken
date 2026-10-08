# DigiToken backend

## Run locally

From the `DigiToken` directory:

```sh
npm start
```

Open <http://localhost:3000/admin.html> in the browser. The server also serves the existing static pages.

## API

- `GET /api/health` checks that the service is running.
- `GET /api/queue` returns the current queue.
- `POST /api/tokens` creates a token. Send `type`, `service`, and optionally `channel`.
- `PATCH /api/tokens/:id/status` changes a token to `waiting`, `serving`, `completed`, or `no-show`.
- `GET /api/notifications` returns notification history.
- `POST /api/notifications` sends a notification event. Send `message`, plus optional `tokenId` and `channel`.
- `GET /api/events` provides live server-sent events for queue updates and notifications.

Queue and notification data is stored in `data/store.json`. The admin page uses the API when served by Node and falls back to its demo behavior when opened directly as a file.

The current delivery channel is browser notifications through the live event stream. Email, WhatsApp, SMS, or push-provider delivery requires provider credentials and can be added inside `createNotification` in `server.js`.


## Environment configuration

For production, configure:

```text
PORT=3000
JWT_SECRET=<long-random-secret>
ADMIN_USERNAME=<admin-username>
ADMIN_PASSWORD=<strong-admin-password>
```

Admin-protected endpoints require a Bearer JWT obtained from `POST /api/auth/login`:

- `PATCH /api/tokens/:id/status`
- `POST /api/notifications`

Public endpoints include health, readiness, queue reads, token creation, and SSE subscription.

## Testing and CI

Run locally:

```sh
npm run check
npm test
```

GitHub Actions runs the same checks on pushes to `main` and `fix/backend`, and on pull requests targeting `main`.

## Persistence roadmap

The prototype currently uses `data/store.json`. Writes are performed through a temporary file and atomic rename to reduce partial-write corruption.

For production migration, use PostgreSQL with transactions and database constraints. The target schema is in `docs/postgresql-schema.sql`. A database sequence/transaction should replace application-side token-number generation to prevent concurrent requests from producing the same number.
