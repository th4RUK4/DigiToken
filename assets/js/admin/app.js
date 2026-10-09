import { state, loadQueue } from './state.js';
import { switchAdminTab } from './navigation.js';
import { enableBrowserNotifications, initLiveNotifications } from './notifications.js';
import {
    callNextToken,
    generateWalkIn,
    markCurrentTokenNoShow,
    renderTokens,
    updateNextWalkInLabel,
    updateStatus
} from './queue.js';

Object.assign(window, {
    callNextToken,
    generateWalkIn,
    markCurrentTokenNoShow,
    switchAdminTab,
    updateStatus
});

async function requireAdminSession() {
    try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (!response.ok) throw new Error('unauthenticated');
        const data = await response.json();
        if (data.user?.role !== 'admin') {
            window.location.href = 'dashboard.html';
            return null;
        }
        state.user = data.user;
        return data.user;
    } catch {
        window.location.href = 'auth.html';
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAdminSession();
    if (!user) return;

    await loadQueue();
    if (!state.backendAvailable) {
        const el = document.getElementById('admin-status');
        if (el) {
            el.hidden = false;
            el.dataset.status = 'error';
            el.textContent = 'Unable to load queue. Confirm you are logged in as admin via npm start.';
        }
    }

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
    document.getElementById('no-show-button')?.addEventListener('click', markCurrentTokenNoShow);
    document.getElementById('logout-button')?.addEventListener('click', async () => {
        const button = document.getElementById('logout-button');
        if (button) button.disabled = true;
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: '{}'
            });
            if (!response.ok) throw new Error('Unable to log out. Please try again.');
            window.location.href = 'auth.html';
        } catch (error) {
            if (button) button.disabled = false;
            const status = document.getElementById('admin-status');
            if (status) {
                status.hidden = false;
                status.dataset.status = 'error';
                status.textContent = error.message;
            }
        }
    });
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
