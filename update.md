# DigiToken Project Update

## Version 1.1

### Backend

- Added a dependency-free Node.js backend in `server.js`.
- Added persistent queue and notification storage in `data/store.json`.
- Added REST endpoints for queue status, token creation, token updates, and notifications.
- Added Server-Sent Events for live queue and notification updates.
- Added static file serving so the complete app runs from one local server.

### Notifications

- Added browser notification permission control in the admin settings.
- Queue creation and status changes generate notification events.
- Added notification history support through `GET /api/notifications`.
- Email, WhatsApp, SMS, and push-provider delivery require provider credentials.

### Admin Refactor

Admin logic is now separated into feature modules:

- `assets/js/admin/app.js` - application startup and event wiring
- `assets/js/admin/state.js` - queue state and API loading
- `assets/js/admin/queue.js` - token actions and rendering
- `assets/js/admin/navigation.js` - admin tab navigation
- `assets/js/admin/notifications.js` - live events and browser notifications
- `assets/css/admin.css` - admin-specific responsive styles

### UX Improvements

- Replaced admin navigation containers with semantic buttons.
- Added keyboard focus states for interactive controls.
- Added responsive layouts for mobile and desktop screens.
- Added reduced-motion support for users who request less animation.
- Added a dynamic Now Serving token display.
- Added a working No Show queue action.
- Added analytics cards and charts to the admin dashboard.

## Run Locally

From the `DigiToken` directory:

```bash
npm start
```

Open `http://localhost:3000/admin.html` in a browser.

For API details, see [BACKEND.md](BACKEND.md).
