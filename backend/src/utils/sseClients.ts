/**
 * SSE Client Registry
 *
 * Manages in-memory SSE connections per user.
 * Each user can have multiple tabs/devices open simultaneously — stored as a Set.
 *
 * Note: This is single-instance. In multi-worker deployments (PM2 cluster),
 * connections are not shared across workers. For production scaling,
 * replace this with Redis pub/sub + a Socket.IO adapter.
 */

import { Response } from 'express';

// Map<userId, Set<active SSE Response objects>>
const clients = new Map<string, Set<Response>>();

/**
 * Register a new SSE client connection for a user.
 */
export function addClient(userId: string, res: Response): void {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)!.add(res);
}

/**
 * Deregister an SSE client connection (on disconnect).
 */
export function removeClient(userId: string, res: Response): void {
  const userClients = clients.get(userId);
  if (userClients) {
    userClients.delete(res);
    if (userClients.size === 0) {
      clients.delete(userId);
    }
  }
}

/**
 * Push an SSE event to all active connections for a given user.
 * @param userId  - target user
 * @param event   - SSE event name (e.g. 'notification', 'sla_breach')
 * @param data    - payload object (will be JSON-serialized)
 */
export function pushToUser(userId: string, event: string, data: unknown): void {
  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) {
    return;
  }

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  // Clone to avoid mutation during iteration
  const clientsArray = Array.from(userClients);
  for (const res of clientsArray) {
    try {
      res.write(payload);
    } catch {
      // Client disconnected — clean up
      userClients.delete(res);
    }
  }

  if (userClients.size === 0) {
    clients.delete(userId);
  }
}

/**
 * Broadcast an event to ALL connected clients (admin announcements, etc.)
 */
export function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  // Clone all user client sets to avoid mutation during iteration
  const allUserClients = Array.from(clients.entries());
  for (const [, userClients] of allUserClients) {
    const clientsArray = Array.from(userClients);
    for (const res of clientsArray) {
      try {
        res.write(payload);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Return the total number of active SSE connections (for monitoring).
 */
export function getClientCount(): number {
  let total = 0;
  for (const userClients of Array.from(clients.values())) {
    total += userClients.size;
  }
  return total;
}

/**
 * Return the number of unique users with active SSE connections.
 */
export function getActiveUserCount(): number {
  return clients.size;
}
