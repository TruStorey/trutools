import type { RateLimitResult } from "./ratelimit";

export const CORS_HEADERS: Record<string, string> = {
  // Public API — the whole point is that anyone can curl it from anywhere.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function rateHeaders(rate?: RateLimitResult): Record<string, string> {
  if (!rate) return {};
  return {
    "X-RateLimit-Limit": String(rate.limit),
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1000)),
  };
}

type TextOptions = {
  status?: number;
  rate?: RateLimitResult;
  headers?: Record<string, string>;
};

/**
 * Every response from /api/v1 is text/plain with a trailing newline, so that
 * `curl ... | read` and shell substitution behave the way people expect from
 * icanhazip-style endpoints.
 */
export function text(body: string, options: TextOptions = {}): Response {
  const { status = 200, rate, headers = {} } = options;
  const payload = body.endsWith("\n") ? body : `${body}\n`;

  return new Response(payload, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
      ...rateHeaders(rate),
      ...headers,
    },
  });
}

/** 429 with Retry-After, in whole seconds, rounded up and never below 1. */
export function tooManyRequests(rate: RateLimitResult): Response {
  const retryAfter = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000));

  return text(
    `429 Too Many Requests\n` +
      `Limit is ${rate.limit} requests per window. Retry in ${retryAfter}s.\n`,
    {
      status: 429,
      rate,
      headers: { "Retry-After": String(retryAfter) },
    },
  );
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
