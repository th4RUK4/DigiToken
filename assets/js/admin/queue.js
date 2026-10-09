import { state, loadQueue } from './state.js';

function showBanner(message, type = 'info') {
    const el = document.getElementById('admin-status');
    if (!el) {
        if (message) window.alert(message);
        return;
    }
    el.hidden = !message;
    el.textContent = message || '';
    el.dataset.status = type;
}

export function renderTokens() {
    const listEl = document.getElementById('token-list');
    const countEl = document.getElementById('queue-count');
    if (!listEl) return;

    const activeTokens = state.tokens.filter(token => !['completed', 'cancelled', 'no-show'].includes(token.status));
    if (countEl) {
        countEl.innerText = activeTokens.filter(token => token.status === 'waiting').length;
    }
    listEl.innerHTML = activeTokens.length
        ? activeTokens.map(tokenMarkup).join('')
        : '<p style="color: var(--text-muted); padding: 12px;">No active tokens in the queue.</p>';
    updateDashboardNowServing();
    renderQueuePreview();
}

export async function generateWalkIn() {
    const token = await createToken('walkin', 'General Enquiry');
    if (token) showBanner(`Token ${token.id} generated.`, 'success');
}

export async function updateStatus(id, newStatus) {
    if (!state.backendAvailable) {
        showBanner('Backend unavailable. Start the app with npm start.', 'error');
        return;
    }

    const response = await fetch(`/api/tokens/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, channel: 'browser' })
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        showBanner(data.error || 'Unable to update this token.', 'error');
        return;
    }
    await loadQueue();
    renderTokens();
    showBanner(`Token ${id} marked ${newStatus}.`, 'success');
}

export function callNextToken() {
    const nextToken = state.tokens.find(token => token.status === 'waiting');
    if (nextToken) return updateStatus(nextToken.id, 'serving');
    showBanner('No tokens waiting in queue.', 'info');
}

export function markCurrentTokenNoShow() {
    const serving = state.tokens.find(token => token.status === 'serving');
    if (serving) return updateStatus(serving.id, 'no-show');
    showBanner('There is no token currently being served.', 'info');
}

export function updateNextWalkInLabel() {
    const element = document.getElementById('next-walkin');
    if (element) element.innerText = `W-${String(state.nextWalkIn).padStart(3, '0')}`;
}

async function createToken(type, service) {
    if (!state.backendAvailable) {
        showBanner('Backend unavailable. Start the app with npm start.', 'error');
        return null;
    }

    const response = await fetch('/api/tokens', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, service, channel: 'browser' })
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        showBanner(data.error || 'Unable to create token.', 'error');
        return null;
    }
    const token = await response.json();
    await loadQueue();
    updateNextWalkInLabel();
    renderTokens();
    return token;
}

function tokenMarkup(token) {
    const isOnline = token.type === 'online';
    const badgeClass = isOnline ? 'badge-online' : 'badge-walkin';
    const typeLabel = isOnline ? 'Pre-Booked' : 'Walk-In';
    const action = token.status === 'waiting'
        ? `<button data-action="serve" data-token-id="${token.id}" class="btn btn-outline token-action">Serve</button>`
        : token.status === 'serving'
            ? `<button data-action="complete" data-token-id="${token.id}" class="btn btn-primary token-action">Done</button>`
            : '';
    const owner = token.userName ? ` • ${token.userName}` : '';

    return `<div class="token-list-item" style="align-items: center;">
        <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-weight: 700; font-size: 1.1rem;">${token.id}</span>
                <span class="badge ${badgeClass}">${typeLabel}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${token.service} • ${token.time || ''}${owner}</div>
        </div>
        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
            <span class="badge ${token.status === 'serving' ? 'badge-status-serving' : 'badge-status-waiting'}">${token.status.charAt(0).toUpperCase() + token.status.slice(1)}</span>
            ${action}
        </div>
    </div>`;
}

function updateDashboardNowServing() {
    const serving = state.tokens.find(token => token.status === 'serving');
    const element = document.getElementById('now-serving-token');
    const status = document.getElementById('now-serving-status');
    const noShowButton = document.getElementById('no-show-button');
    if (element) element.innerText = serving ? serving.id : '—';
    if (status) status.innerText = serving ? `${serving.service || 'Customer'} is being served` : 'No token is being served';
    if (noShowButton) noShowButton.disabled = !serving || !state.backendAvailable;
}

function renderQueuePreview() {
    const previewEl = document.getElementById('queue-preview');
    if (!previewEl) return;

    const waitingTokens = state.tokens
        .filter(token => token.status === 'waiting' || token.status === 'called')
        .sort((left, right) => new Date(left.createdAt || left.time || 0) - new Date(right.createdAt || right.time || 0));

    if (!waitingTokens.length) {
        previewEl.innerHTML = '<p style="color: var(--text-muted); padding: 12px;">No one is waiting.</p>';
        return;
    }

    previewEl.replaceChildren(...waitingTokens.slice(0, 5).map(token => {
        const row = document.createElement('div');
        row.className = 'token-list-item';
        row.style.borderRadius = '8px';

        const id = document.createElement('span');
        id.style.fontWeight = '700';
        id.textContent = token.id;

        const details = document.createElement('span');
        details.style.color = 'var(--text-muted)';
        details.textContent = `${token.status === 'called' ? 'Called' : 'Waiting'}${token.time ? ` · ${token.time}` : ''}`;

        row.append(id, details);
        return row;
    }));
}
