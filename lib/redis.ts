/**
 * lib/redis.ts
 *
 * Exports:
 *   redis               — singleton publisher/general-purpose client
 *   createRedisSubscriber() — factory; call once per SSE connection,
 *                             disconnect when done (never share across requests)
 *
 * Reads: process.env.REDIS_URL
 */

import Redis from 'ioredis';

function buildRedisOptions(): { lazyConnect: boolean } & ConstructorParameters<typeof Redis>[1] {
  return {
    lazyConnect: false,
    maxRetriesPerRequest: null,   // required for BullMQ compat; harmless here
    enableReadyCheck: true,
    retryStrategy: (times: number) => Math.min(times * 200, 5000),
  };
}

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('[redis] REDIS_URL environment variable is not set');
  return url;
}

// ── singleton publisher ────────────────────────────────────────────────────────

let _publisher: Redis | null = null;

function getPublisher(): Redis {
  if (_publisher) return _publisher;

  _publisher = new Redis(getRedisUrl(), buildRedisOptions());

  _publisher.on('connect', () => console.log('[redis] publisher connected'));
  _publisher.on('error', (err: Error) => console.error('[redis] publisher error:', err.message));
  _publisher.on('close', () => console.warn('[redis] publisher connection closed'));

  return _publisher;
}

export const redis: Redis = new Proxy({} as Redis, {
  get(_target, prop) {
    return (getPublisher() as unknown as Record<string, unknown>)[prop as string];
  },
});

// ── subscriber factory ─────────────────────────────────────────────────────────

/**
 * Creates a fresh dedicated Redis subscriber client.
 * Each SSE connection must call this and disconnect() when done.
 * NEVER share a subscriber across requests — ioredis subscribers
 * cannot send regular commands while subscribed.
 */
export function createRedisSubscriber(): Redis {
  const sub = new Redis(getRedisUrl(), {
    ...buildRedisOptions(),
    lazyConnect: false,
  });

  sub.on('connect', () => console.log('[redis] SSE subscriber connected'));
  sub.on('error', (err: Error) => console.error('[redis] subscriber error:', err.message));

  return sub;
}

// ── channel constant ───────────────────────────────────────────────────────────

export const SOCIAL_UPDATES_CHANNEL = 'social-updates' as const;

// ── payload type ───────────────────────────────────────────────────────────────

export interface SocialUpdatePayload {
  type: 'social-update';
  platform: string;
  conversationId: string | null;
  messageId: string | null;
  timestamp: string;
}
