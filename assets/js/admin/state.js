export const state = {
    tokens: [
        { id: 'A-14', type: 'online', service: 'Bank Service', status: 'serving', time: '10:00 AM' },
        { id: 'A-15', type: 'online', service: 'Bank Service', status: 'waiting', time: '10:05 AM' },
        { id: 'W-005', type: 'walkin', service: 'General', status: 'waiting', time: '10:12 AM' },
        { id: 'A-16', type: 'online', service: 'Bank Service', status: 'waiting', time: '10:15 AM' }
    ],
    nextWalkIn: 6,
    nextOnline: 17,
    backendAvailable: false
};

export async function loadQueue() {
    try {
        const response = await fetch('/api/queue');
        if (!response.ok) throw new Error('Queue API unavailable');
        const data = await response.json();
        state.tokens = data.tokens;
        state.backendAvailable = true;
    } catch {
        // Keep the demo usable when this page is opened directly as a file.
        state.backendAvailable = false;
    }
}
