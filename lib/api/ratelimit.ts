import { getRedis } from "./redis";

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Epoch millis at which the oldest request in the window falls out. */
  resetAt: number;
};

const DEFAULT_MAX = 60;
const DEFAULT_WINDOW_SEC = 60;

function config() {
  const max = Number.parseInt(process.env.RATE_LIMIT_MAX ?? "", 10);
  const windowSec = Number.parseInt(process.env.RATE_LIMIT_WINDOW_SEC ?? "", 10);
  return {
    max: Number.isFinite(max) && max > 0 ? max : DEFAULT_MAX,
    windowMs: (Number.isFinite(windowSec) && windowSec > 0 ? windowSec : DEFAULT_WINDOW_SEC) * 1000,
  };
}

/**
 * Sliding-window log, evaluated atomically in one round trip.
 *
 * KEYS[1] sorted set of request timestamps for this caller
 * ARGV[1] now (epoch millis)
 * ARGV[2] window length (millis)
 * ARGV[3] max requests in the window
 * ARGV[4] unique member, so simultaneous requests at the same millisecond
 *         do not collapse into a single ZSET entry
 *
 * Returns { allowed, count, oldest }. The entry is only added when the request
 * is allowed, so a caller hammering a 429 does not extend their own lockout.
 */
const SLIDING_WINDOW_LUA = `
local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max    = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

local count = redis.call('ZCARD', key)
local allowed = 0

if count < max then
  redis.call('ZADD', key, now, member)
  count = count + 1
  allowed = 1
end

redis.call('PEXPIRE', key, window)

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestScore = now
if oldest[2] then
  oldestScore = tonumber(oldest[2])
end

return { allowed, count, oldestScore }
`;

/** Fallback used only when REDIS_URL is unset. Per-process, resets on restart. */
const memoryLog = new Map<string, number[]>();

function memoryLimit(key: string, now: number, windowMs: number, max: number): RateLimitResult {
  const cutoff = now - windowMs;
  const hits = (memoryLog.get(key) ?? []).filter((ts) => ts > cutoff);

  if (hits.length < max) {
    hits.push(now);
    memoryLog.set(key, hits);
    return {
      ok: true,
      limit: max,
      remaining: max - hits.length,
      resetAt: (hits[0] ?? now) + windowMs,
    };
  }

  memoryLog.set(key, hits);
  return { ok: false, limit: max, remaining: 0, resetAt: (hits[0] ?? now) + windowMs };
}

export async function rateLimit(identifier: string): Promise<RateLimitResult> {
  const { max, windowMs } = config();
  const now = Date.now();
  const key = `trutools:rl:${identifier}`;
  const redis = getRedis();

  if (!redis) {
    return memoryLimit(key, now, windowMs, max);
  }

  try {
    const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;
    const [allowed, count, oldest] = (await redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      key,
      String(now),
      String(windowMs),
      String(max),
      member,
    )) as [number, number, number];

    return {
      ok: allowed === 1,
      limit: max,
      remaining: Math.max(0, max - count),
      resetAt: oldest + windowMs,
    };
  } catch (error) {
    // Fail open. A Redis blip should not take a public utility API offline;
    // the alternative is refusing every request while Redis recovers.
    console.error("[trutools] rate limit check failed, allowing request:", error);
    return { ok: true, limit: max, remaining: max, resetAt: now + windowMs };
  }
}
