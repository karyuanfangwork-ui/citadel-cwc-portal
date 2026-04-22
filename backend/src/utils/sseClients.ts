import { Response } from 'express';

// In-memory store of SSE connections keyed by userId.
// A user may have multiple tabs open, so we store a Set per user.
const clients = new Map<string, Set<Response>>();

export function addClient(userId: string, res: Response): void {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)!.add(res);
}

export function removeClient(userId: string, res: Response): void {
  clients.get(userId)?.delete(res);
  if (clients.get(userId)?.size === 0) {
    clients.delete(userId);
  }
}

export function pushToUser(userId: string, event: string, data: unknown): void {
  const userClients = clients.get(userId);
  if (!userClients) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of userClients) {
    res.write(payload);
  }
}
