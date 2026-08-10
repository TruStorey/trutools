import {
  CONTENT_TYPES,
  formatError,
  formatResult,
  type ApiFormat,
} from "@/lib/tools/format";
import type { ToolResult } from "@/lib/tools/result";

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

type BodyOptions = {
  status?: number;
  rate?: RateLimitResult;
  format?: ApiFormat;
  headers?: Record<string, string>;
};

/** Sends an already-rendered body with the right content type for `format`. */
export function body(content: string, options: BodyOptions = {}): Response {
  const { status = 200, rate, format = "text", headers = {} } = options;

  // Trailing newline so `curl ... | read` and shell substitution behave the way
  // people expect from icanhazip-style endpoints. JSON and XML get one too;
  // no parser minds, and it keeps terminal output tidy.
  const payload = content.endsWith("\n") ? content : `${content}\n`;

  return new Response(payload, {
    status,
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Cache-Control": "no-store",
      // The tools answer on root-level paths now, which are exactly the sort
      // of URL a crawler will happily index. Nothing here is worth a search
      // result, and a stale indexed password would be a bad look.
      "X-Robots-Tag": "noindex, nofollow",
      ...CORS_HEADERS,
      ...rateHeaders(rate),
      ...headers,
    },
  });
}

/** Kept for plain-text endpoints that are not tool results, like the index. */
export function text(content: string, options: Omit<BodyOptions, "format"> = {}): Response {
  return body(content, { ...options, format: "text" });
}

/** Renders a tool result in the caller's requested format. */
export function result(
  tool: string,
  value: ToolResult,
  format: ApiFormat,
  rate?: RateLimitResult,
): Response {
  return body(formatResult(tool, value, format), { format, rate });
}

/** Errors are emitted in the caller's format too, so clients can parse either. */
export function failure(
  message: string,
  status: number,
  format: ApiFormat,
  rate?: RateLimitResult,
  headers?: Record<string, string>,
): Response {
  return body(formatError(message, status, format), { status, format, rate, headers });
}

/** 429 with Retry-After, in whole seconds, rounded up and never below 1. */
export function tooManyRequests(rate: RateLimitResult, format: ApiFormat = "text"): Response {
  const retryAfter = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000));

  return failure(
    `Too Many Requests. Limit is ${rate.limit} requests per window. Retry in ${retryAfter}s.`,
    429,
    format,
    rate,
    { "Retry-After": String(retryAfter) },
  );
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
