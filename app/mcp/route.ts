import { rateLimitKey } from "@/lib/api/client-ip";
import { rateLimit, type RateLimitResult } from "@/lib/api/ratelimit";
import { serveMcp } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

/**
 * The API's CORS headers, plus the two MCP adds. A browser-hosted MCP client
 * sends Mcp-Protocol-Version on every call after initialize, and the preflight
 * fails without it.
 */
const MCP_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

function withHeaders(response: Response, rate?: RateLimitResult): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(MCP_CORS_HEADERS)) headers.set(name, value);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  if (rate) {
    headers.set("X-RateLimit-Limit", String(rate.limit));
    headers.set("X-RateLimit-Remaining", String(rate.remaining));
    headers.set("X-RateLimit-Reset", String(Math.ceil(rate.resetAt / 1000)));
  }
  return new Response(response.body, { status: response.status, headers });
}

/** A JSON-RPC error with no id, for failures before the transport sees the message. */
function rpcError(status: number, message: string, extra: Record<string, string> = {}) {
  return withHeaders(
    new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }), {
      status,
      headers: { "Content-Type": "application/json", ...extra },
    }),
  );
}

/**
 * Stateless Streamable HTTP, served by serveMcp().
 *
 * One POST is one rate-limit hit, on the same budget as the HTTP API — an
 * agent calling lookup_dns is a curl user with extra steps.
 */
export async function POST(request: Request) {
  const rate = await rateLimit(rateLimitKey(request.headers));
  if (!rate.ok) {
    const retryAfter = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000));
    return withHeaders(
      rpcError(429, `Too Many Requests. Retry in ${retryAfter}s.`, {
        "Retry-After": String(retryAfter),
      }),
      rate,
    );
  }

  try {
    return withHeaders(await serveMcp(request), rate);
  } catch (error) {
    console.error("[trutools] mcp request failed:", error);
    return rpcError(500, "Internal Server Error");
  }
}

/** Stateless servers have no SSE stream to open and no session to end. */
function methodNotAllowed() {
  return rpcError(405, "Method not allowed. POST JSON-RPC to this endpoint.", { Allow: "POST, OPTIONS" });
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: MCP_CORS_HEADERS });
}
