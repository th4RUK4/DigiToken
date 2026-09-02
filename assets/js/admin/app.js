import { state, loadQueue } from './state.js';
import { switchAdminTab } from './navigation.js';
import { enableBrowserNotifications, initLiveNotifications } from './notifications.js';
import {
    callNextToken,
    generateWalkIn,
    renderTokens,
    simulateOnlineBooking,
    updateNextWalkInLabel,
    updateStatus
} from './queue.js';

Object.assign(window, {
    callNextToken,
    generateWalkIn,
    simulateOnlineBooking,
    switchAdminTab,
    updateStatus
});

document.addEventListener('DOMContentLoaded', async () => {
    await loadQueue();
    updateNextWalkInLabel();
    renderTokens();
    initLiveNotifications({
        enabled: state.backendAvailable,
        onQueueUpdated(tokens) {
            state.tokens = tokens;
            renderTokens();
        }
    });
    document.getElementById('enable-browser-notifications')?.addEventListener('click', enableBrowserNotifications);
    document.querySelector('.bottom-nav')?.addEventListener('click', event => {
        const button = event.target.closest('[data-view]');
        if (!button) return;
        switchAdminTab(button.dataset.view, button);
    });
    document.getElementById('token-list')?.addEventListener('click', event => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        updateStatus(button.dataset.tokenId, button.dataset.action === 'serve' ? 'serving' : 'completed');
    });
});
