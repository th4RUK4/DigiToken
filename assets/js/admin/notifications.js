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
    if (!('Notification' in window)) {
        alert('Browser notifications are not supported here.');
        return;
    }

    const permission = await Notification.requestPermission();
    alert(permission === 'granted' ? 'Browser notifications enabled.' : 'Browser notifications were not enabled.');
}

function showBrowserNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('DigiToken Queue Update', { body: message });
    }
}
