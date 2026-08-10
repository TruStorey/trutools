import Redis from "ioredis";

/**
 * Lazily-constructed Redis singleton.
 *
 * Stashed on globalThis because Next's dev server re-evaluates modules on every
 * hot reload; without this each reload would open another connection until
 * Redis refuses them.
 */
const globalForRedis = globalThis as unknown as {
  __trutoolsRedis?: Redis | null;
  __trutoolsRedisWarned?: boolean;
};

export function getRedis(): Redis | null {
  if (globalForRedis.__trutoolsRedis !== undefined) {
    return globalForRedis.__trutoolsRedis;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    if (!globalForRedis.__trutoolsRedisWarned) {
      globalForRedis.__trutoolsRedisWarned = true;
      console.warn(
        "[trutools] REDIS_URL is not set — falling back to an in-process rate limiter. " +
          "This resets on restart and is per-replica, so do not run production this way.",
      );
    }
    globalForRedis.__trutoolsRedis = null;
    return null;
  }

  const client = new Redis(url, {
    // The offline queue stays ON deliberately. With it off, any request that
    // arrives before the connection is ready throws immediately, the limiter
    // fails open, and the first few requests after every cold start bypass the
    // rate limit entirely. Queueing lets them wait for the handshake instead.
    enableOfflineQueue: true,
    // ...but the queue must be bounded, or a genuinely dead Redis would stall
    // every API request until the socket gives up. commandTimeout caps the
    // wait; the limiter catches the timeout and fails open from there.
    commandTimeout: 1000,
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
    lazyConnect: false,
  });

  client.on("error", (error) => {
    console.error("[trutools] redis error:", error.message);
  });

  globalForRedis.__trutoolsRedis = client;
  return client;
}
