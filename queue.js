function getNextSequence(tokens, type) {
  const prefix = type === 'walkin' ? 'W' : 'A';
  const last = tokens
    .filter(token => token.id.startsWith(`${prefix}-`))
    .map(token => Number.parseInt(token.id.split('-')[1], 10))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .at(-1) || 0;

  return last + 1;
}

function createTokenRecord(tokens, { type, service, userId = null, userName = null, sequence }) {
  const safeType = type === 'walkin' ? 'walkin' : 'online';
  const tokenSequence = sequence ?? getNextSequence(tokens, safeType === 'walkin' ? 'walkin' : 'online');
  const id = `${safeType === 'walkin' ? 'W' : 'A'}-${String(tokenSequence).padStart(3, '0')}`;
  const timestamp = new Date().toISOString();

  return {
    id,
    type: safeType,
    service,
    status: 'waiting',
    userId: userId || null,
    userName: userName || null,
    createdAt: timestamp,
    calledAt: null,
    servedAt: null,
    completedAt: null,
    time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}

function estimateWaitMinutes(tokens, tokenId, minutesPerToken = 5) {
  const active = ['waiting', 'called', 'serving'];
  const token = tokens.find(item => item.id === tokenId);
  if (!token || !active.includes(token.status)) return 0;
  if (token.status === 'serving') return 0;

  const waiting = tokens
    .filter(item => item.status === 'waiting' || item.status === 'called')
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt || left.time || 0).getTime();
      const rightTime = new Date(right.createdAt || right.time || 0).getTime();
      return leftTime - rightTime;
    });

  const position = waiting.findIndex(item => item.id === tokenId);
  if (position === -1) return 0;
  return (position + (getCurrentServingToken(tokens) ? 1 : 0)) * minutesPerToken;
}

function queuePosition(tokens, tokenId) {
  const waiting = tokens
    .filter(item => item.status === 'waiting' || item.status === 'called')
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt || left.time || 0).getTime();
      const rightTime = new Date(right.createdAt || right.time || 0).getTime();
      return leftTime - rightTime;
    });
  const index = waiting.findIndex(item => item.id === tokenId);
  return index === -1 ? null : index + 1;
}

function getNextWaitingToken(tokens) {
  const waiting = tokens.filter(token => token.status === 'waiting');

  return waiting.sort((left, right) => {
    const leftTime = new Date(left.createdAt || left.time || 0).getTime();
    const rightTime = new Date(right.createdAt || right.time || 0).getTime();
    return leftTime - rightTime;
  })[0] || null;
}

function getCurrentServingToken(tokens) {
  return tokens.find(token => token.status === 'serving') || null;
}

function updateTokenStatus(tokens, tokenId, nextStatus) {
  const current = tokens.find(token => token.id === tokenId);
  if (!current) {
    throw new Error(`token not found: ${tokenId}`);
  }

  const allowedTransitions = {
    waiting: ['called', 'serving', 'cancelled', 'no-show'],
    called: ['serving', 'cancelled', 'no-show'],
    serving: ['completed', 'no-show', 'cancelled'],
    completed: [],
    'no-show': [],
    cancelled: []
  };

  if (!allowedTransitions[current.status]?.includes(nextStatus)) {
    throw new Error(`invalid status transition from ${current.status} to ${nextStatus}`);
  }

  const updated = tokens.map(token => {
    if (token.id === tokenId) {
      const timestamp = new Date().toISOString();
      return {
        ...token,
        status: nextStatus,
        calledAt: nextStatus === 'called' ? timestamp : token.calledAt,
        servedAt: nextStatus === 'serving' ? timestamp : token.servedAt,
        completedAt: nextStatus === 'completed' ? timestamp : token.completedAt
      };
    }

    if (token.status === 'serving' && nextStatus === 'serving') {
      return { ...token, status: 'completed', completedAt: new Date().toISOString() };
    }

    return token;
  });

  return updated;
}

module.exports = {
  createTokenRecord,
  getNextWaitingToken,
  getCurrentServingToken,
  updateTokenStatus,
  estimateWaitMinutes,
  queuePosition
};
