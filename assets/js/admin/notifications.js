export function initLiveNotifications({ onQueueUpdated, enabled }) {
    if (!enabled || typeof EventSource === 'undefined') return;

    const events = new EventSource('/api/events');
    events.addEventListener('queue-updated', event => {
        onQueueUpdated(JSON.parse(event.data).tokens);
    });
    events.addEventListener('notification', event => {
        const notification = JSON.parse(event.data);
        if (notification.channel === 'browser') showBrowserNotification(notification.message);
    });
}

export async function enableBrowserNotifications() {
    const el = document.getElementById('admin-status');
    if (!('Notification' in window)) {
        if (el) {
            el.hidden = false;
            el.dataset.status = 'error';
            el.textContent = 'Browser notifications are not supported here.';
        }
        return;
    }

    const permission = await Notification.requestPermission();
    if (el) {
        el.hidden = false;
        el.dataset.status = permission === 'granted' ? 'success' : 'info';
        el.textContent = permission === 'granted'
            ? 'Browser notifications enabled.'
            : 'Browser notifications were not enabled.';
    }
}

function showBrowserNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('DigiToken Queue Update', { body: message });
    }
}
