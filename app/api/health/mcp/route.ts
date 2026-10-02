import { serveMcp } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

/**
 * How long one answer is reused. The island polls every 30s per open tab, and
 * this endpoint is exempt from the rate limit, so without a cache each poll
 * would build a full MCP server. Ten seconds keeps it cheap without letting a
 * real failure hide for long.
 */
const CACHE_MS = 10_000;

let cached: { at: number; status: number; body: string } | null = null;

/** A tools/list over the real MCP path, in-process: no network, no rate limit. */
async function probe(): Promise<{ status: number; body: string }> {
  try {
    // The URL is never read for anything — the transport only needs a Request.
    const response = await serveMcp(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );

    if (!response.ok) return { status: 503, body: `mcp answered ${response.status}\n` };

    const payload = await response.json();
    const count = Array.isArray(payload?.result?.tools) ? payload.result.tools.length : 0;
    if (count === 0) return { status: 503, body: "mcp listed no tools\n" };

    return { status: 200, body: `ok, ${count} tools\n` };
  } catch (error) {
    console.error("[trutools] mcp healthcheck failed:", error);
    return { status: 503, body: "mcp failed\n" };
  }
}

/**
 * MCP's counterpart to /api/health, polled by the navbar island.
 *
 * Not a hit on POST /mcp: that would spend the visitor's own rate limit on
 * every poll. Running the same serveMcp() in-process proves the same things —
 * the SDK loads, the registry converts, tools/list answers — for free.
 */
export async function GET() {
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    cached = { at: Date.now(), ...(await probe()) };
  }

  return new Response(cached.body, {
    status: cached.status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
