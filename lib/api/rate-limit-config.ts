/**
 * The rate limit, read from the environment.
 *
 * Split out from ratelimit.ts so the UI can state the real numbers without
 * pulling ioredis into the page's server bundle.
 *
 * Read at request time by the limiter and by /api/health. The homepage is
 * statically prerendered, so anything *it* renders from here is fixed at build
 * time — which is why the API dialog re-reads the policy from /api/health when
 * it opens rather than trusting its server-rendered prop.
 */

const DEFAULT_MAX = 60;
const DEFAULT_WINDOW_SEC = 60;

export type RateLimitConfig = { max: number; windowSec: number };

export function rateLimitConfig(): RateLimitConfig {
  const max = Number.parseInt(process.env.RATE_LIMIT_MAX ?? "", 10);
  const windowSec = Number.parseInt(process.env.RATE_LIMIT_WINDOW_SEC ?? "", 10);

  return {
    max: Number.isFinite(max) && max > 0 ? max : DEFAULT_MAX,
    windowSec:
      Number.isFinite(windowSec) && windowSec > 0 ? windowSec : DEFAULT_WINDOW_SEC,
  };
}

/** "minute" reads better than "60s" for the common case. */
export function describeWindow(windowSec: number): string {
  if (windowSec === 60) return "minute";
  if (windowSec === 3600) return "hour";
  return `${windowSec} seconds`;
}
