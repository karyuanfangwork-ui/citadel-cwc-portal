/**
 * SSE Client Registry with Redis Pub/Sub Adapter
 *
 * Manages SSE connections per user. In single-instance mode, notifications
 * are delivered directly. In multi-instance deployments, a Redis pub/sub
 * channel fans out notification events to all processes so that the instance
 * holding the user's SSE connection can deliver it.
 *
 * Architecture:
 *   ┌──────────┐         ┌───────────┐         ┌──────────┐
 *   │ Process 1 │◄────────┤   Redis   ├────────►│ Process 2 │
 *   │  (local   │  sub    │  Pub/Sub  │   sub   │  (local   │
 *   │  clients) │         │  channel  │         │  clients) │
 *   └──────────┘         └───────────┘         └──────────┘
 *
 * Flow:
 *   1. pushToUser(userId, event, data) → publish to Redis channel
 *   2. Redis broadcasts to ALL subscribers
 *   3. Each subscriber calls deliverLocal() → writes to local SSE connections
 *   4. If userId has no local connections, the write is a no-op
 *
 * Graceful fallback: If Redis is unavailable, falls back to single-instance
 * direct delivery (process-local only).
 */

import { Response } from 'express';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

// ── Channel name for Redis pub/sub ──────────────────────────────────────────
const SSE_CHANNEL = 'cwc:sse:notify';

// ── In-memory local client registry ─────────────────────────────────────────
// Map<userId, Set<active SSE Response objects>>
const clients = new Map<string, Set<Response>>();

// ── Redis connections ────────────────────────────────────────────────────────
// Separate connections for publisher and subscriber (ioredis requirement:
// a subscriber connection enters SUBSCRIBE mode and cannot issue other commands).
let publisher: Redis | null = null;
let subscriber: Redis | null = null;
let redisEnabled = false;

/**
 * Initialize Redis pub/sub connections.
 * Called once at app startup. If Redis is unavailable, logs a warning
 * and falls back to single-instance direct delivery.
 */
export function initSseRedis(): void {
  try {
    publisher = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 5000),
      lazyConnect: true,
    });

    subscriber = new Redis(config.redis.url, {
      maxRetriesPerRequest: null, // subscriber must not fail on long waits
      retryStrategy: (times) => Math.min(times * 200, 5000),
      lazyConnect: true,
    });

    // Handle incoming messages from other instances
    subscriber.on('message', (_channel: string, message: string) => {
      try {
        const payload = JSON.parse(message) as SseMessage;
        deliverLocal(payload.userId, payload.event, payload.data);
      } catch (err) {
        logger.error('SSE: failed to parse Redis message', { error: String(err) });
      }
    });

    // Connect and subscribe
    Promise.all([publisher.connect(), subscriber.connect()])
      .then(() => subscriber!.subscribe(SSE_CHANNEL))
      .then(() => {
        redisEnabled = true;
        logger.info('SSE: Redis pub/sub adapter initialized');
      })
      .catch((err) => {
        logger.warn('SSE: Redis pub/sub unavailable — falling back to single-instance mode', {
          error: String(err),
        });
        redisEnabled = false;
        publisher = null;
        subscriber = null;
      });
  } catch (err) {
    logger.warn('SSE: Redis pub/sub init skipped — single-instance mode', { error: String(err) });
    redisEnabled = false;
  }
}

// ── Message shape for Redis channel ──────────────────────────────────────────
interface SseMessage {
  userId: string;
  event: string;
  data: unknown;
}

// ── Client management ───────────────────────────────────────────────────────

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

// ── Notification delivery ────────────────────────────────────────────────────

/**
 * Push an SSE event to a specific user.
 * If Redis pub/sub is enabled, the event is published to the Redis channel
 * so ALL instances receive it. The instance holding the user's connection
 * will deliver it locally. Falls back to direct local delivery if Redis is down.
 */
export function pushToUser(userId: string, event: string, data: unknown): void {
  if (redisEnabled && publisher) {
    // Publish to Redis — all instances (including this one) will receive it
    const message: SseMessage = { userId, event, data };
    publisher.publish(SSE_CHANNEL, JSON.stringify(message)).catch((err) => {
      logger.warn('SSE: Redis publish failed — falling back to local delivery', { error: String(err) });
      // Fallback: deliver locally only
      deliverLocal(userId, event, data);
    });
  } else {
    // Single-instance mode: deliver directly
    deliverLocal(userId, event, data);
  }
}

/**
 * Broadcast an event to ALL connected clients (admin announcements, etc.)
 * Uses Redis fan-out if available; falls back to local broadcast.
 */
export function broadcast(event: string, data: unknown): void {
  if (redisEnabled && publisher) {
    // Use a special userId marker to indicate broadcast
    const message: SseMessage = { userId: '__broadcast__', event, data };
    publisher.publish(SSE_CHANNEL, JSON.stringify(message)).catch((err) => {
      logger.warn('SSE: Redis broadcast publish failed — falling back to local', { error: String(err) });
      broadcastLocal(event, data);
    });
  } else {
    broadcastLocal(event, data);
  }
}

// ── Local delivery (used by both direct and Redis-triggered paths) ───────────

/**
 * Deliver an event to all local SSE connections for a user.
 * This is the actual write to the HTTP response objects.
 * Safe to call even if the user has no local connections (no-op).
 */
export function deliverLocal(userId: string, event: string, data: unknown): void {
  if (userId === '__broadcast__') {
    broadcastLocal(event, data);
    return;
  }

  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) {
    return; // No local connections for this user — another instance handles it
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
 * Broadcast to all locally connected clients.
 */
function broadcastLocal(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  const allUserClients = Array.from(clients.entries());
  for (const [, userClients] of allUserClients) {
    const clientsArray = Array.from(userClients);
    for (const res of clientsArray) {
      try {
        res.write(payload);
      } catch {
        // ignore disconnected clients
      }
    }
  }
}

/**
 * Disconnect Redis connections gracefully (for shutdown).
 */
export function disconnectSseRedis(): void {
  if (subscriber) {
    subscriber.disconnect();
    subscriber = null;
  }
  if (publisher) {
    publisher.disconnect();
    publisher = null;
  }
  redisEnabled = false;
}

// ── Monitoring helpers ───────────────────────────────────────────────────────

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

/**
 * Return whether Redis pub/sub is currently connected.
 * Useful for health checks.
 */
export function isRedisConnected(): boolean {
  return redisEnabled;
}