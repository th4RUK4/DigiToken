export const state = {
    tokens: [],
    nextWalkIn: 1,
    nextOnline: 1,
    backendAvailable: false,
    user: null
};

export async function loadQueue() {
    try {
        const response = await fetch('/api/queue', { credentials: 'include' });
        if (!response.ok) throw new Error('Queue API unavailable');
        const data = await response.json();
        state.tokens = data.tokens || [];
        state.backendAvailable = true;
        syncCounters();
    } catch {
        state.backendAvailable = false;
    }
}

function syncCounters() {
    const walkins = state.tokens
        .filter(token => token.id.startsWith('W-'))
        .map(token => Number.parseInt(token.id.split('-')[1], 10))
        .filter(Number.isFinite);
    const onlines = state.tokens
        .filter(token => token.id.startsWith('A-'))
        .map(token => Number.parseInt(token.id.split('-')[1], 10))
        .filter(Number.isFinite);
    state.nextWalkIn = (walkins.sort((a, b) => a - b).at(-1) || 0) + 1;
    state.nextOnline = (onlines.sort((a, b) => a - b).at(-1) || 0) + 1;
}
