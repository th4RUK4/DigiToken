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
