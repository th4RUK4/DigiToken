function createEventHub() {
  const clients = new Map();

  function connect(response, user) {
    clients.set(response, { userId: user.id, role: user.role });
  }

  function disconnect(response) {
    clients.delete(response);
  }

  function broadcast(event, payload) {
    for (const [response, client] of clients) {
      if (event === 'notification' && client.role !== 'admin' && client.userId !== payload.userId) continue;
      const clientPayload = event === 'queue-updated' && client.role !== 'admin' ? {} : payload;
      response.write(`event: ${event}\ndata: ${JSON.stringify(clientPayload)}\n\n`);
    }
  }

  return { connect, disconnect, broadcast };
}

module.exports = { createEventHub };
