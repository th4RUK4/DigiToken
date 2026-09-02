import { state, loadQueue } from './state.js';

export function renderTokens() {
    const listEl = document.getElementById('token-list');
    const countEl = document.getElementById('queue-count');
    if (!listEl) return;

    const activeTokens = state.tokens.filter(token => token.status !== 'completed');
    countEl.innerText = activeTokens.filter(token => token.status === 'waiting').length;
    listEl.innerHTML = activeTokens.map(tokenMarkup).join('');
    updateDashboardNowServing();
}

export async function generateWalkIn() {
    const token = await createToken('walkin', 'General Enquiry');
    if (token) alert(`Token ${token.id} generated!`);
}

export async function simulateOnlineBooking() {
    await createToken('online', 'Bank Service');
}

export async function updateStatus(id, newStatus) {
    if (state.backendAvailable) {
        const response = await fetch(`/api/tokens/${encodeURIComponent(id)}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, channel: 'browser' })
        });
        if (!response.ok) return alert('Unable to update this token.');
        await loadQueue();
        renderTokens();
        return;
    }

    const token = state.tokens.find(item => item.id === id);
    if (!token) return;
    if (newStatus === 'serving') {
        state.tokens.forEach(item => {
            if (item.status === 'serving') item.status = 'completed';
        });
    }
    token.status = newStatus;
    renderTokens();
}

export function callNextToken() {
    const nextToken = state.tokens.find(token => token.status === 'waiting');
    if (nextToken) return updateStatus(nextToken.id, 'serving');
    alert('No tokens waiting in queue.');
}

export function updateNextWalkInLabel() {
    const element = document.getElementById('next-walkin');
    if (element) element.innerText = `W-${String(state.nextWalkIn).padStart(3, '0')}`;
}

async function createToken(type, service) {
    if (state.backendAvailable) {
        const response = await fetch('/api/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, service, channel: 'browser' })
        });
        if (!response.ok) return null;
        const token = await response.json();
        state.tokens.push(token);
        if (type === 'walkin') state.nextWalkIn++;
        if (type === 'online') state.nextOnline++;
        updateNextWalkInLabel();
        renderTokens();
        return token;
    }

    const sequence = type === 'walkin' ? state.nextWalkIn++ : state.nextOnline++;
    const token = {
        id: `${type === 'walkin' ? 'W' : 'A'}-${String(sequence).padStart(3, '0')}`,
        type,
        status: 'waiting',
        service,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    state.tokens.push(token);
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

    return `<div class="token-list-item" style="align-items: center;">
        <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-weight: 700; font-size: 1.1rem;">${token.id}</span>
                <span class="badge ${badgeClass}">${typeLabel}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${token.service} • ${token.time}</div>
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
    if (element) element.innerText = serving ? serving.id : '--';
}
