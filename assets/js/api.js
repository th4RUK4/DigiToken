/* Shared DigiToken API helpers (session cookies via credentials: 'include') */

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers,
    body: options.body && typeof options.body !== 'string'
      ? JSON.stringify(options.body)
      : options.body
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    const error = new Error((data && data.error) || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function getMe() {
  return apiRequest('/api/auth/me');
}

async function requireAuth({ admin = false, redirectTo = 'auth.html' } = {}) {
  try {
    const { user } = await getMe();
    if (admin && user.role !== 'admin') {
      window.location.href = 'dashboard.html';
      return null;
    }
    return user;
  } catch {
    window.location.href = redirectTo;
    return null;
  }
}

function subscribeEvents(handlers = {}) {
  if (typeof EventSource === 'undefined') return null;
  const source = new EventSource('/api/events');

  if (handlers.onQueueUpdated) {
    source.addEventListener('queue-updated', event => {
      try {
        handlers.onQueueUpdated(JSON.parse(event.data));
      } catch (error) {
        console.error(error);
      }
    });
  }

  if (handlers.onNotification) {
    source.addEventListener('notification', event => {
      try {
        handlers.onNotification(JSON.parse(event.data));
      } catch (error) {
        console.error(error);
      }
    });
  }

  source.onerror = () => {
    if (handlers.onError) handlers.onError();
  };

  return source;
}

function showStatus(el, message, type = 'info') {
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || '';
  el.dataset.status = type;
}

function initialsFor(user) {
  if (!user) return '?';
  const first = (user.firstName || '?')[0];
  const last = (user.lastName || '')[0] || '';
  return `${first}${last}`.toUpperCase();
}

function activeTokenFromMine(mine = []) {
  const activeStatuses = new Set(['waiting', 'called', 'serving']);
  return mine.find(token => activeStatuses.has(token.status)) || null;
}

function formatPosition(position) {
  if (!position) return '—';
  const mod100 = position % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${position}th`;
  const mod10 = position % 10;
  if (mod10 === 1) return `${position}st`;
  if (mod10 === 2) return `${position}nd`;
  if (mod10 === 3) return `${position}rd`;
  return `${position}th`;
}

window.DigiTokenApi = {
  apiRequest,
  getMe,
  requireAuth,
  subscribeEvents,
  showStatus,
  initialsFor,
  activeTokenFromMine,
  formatPosition
};
