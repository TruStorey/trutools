export const dynamic = "force-dynamic";

/**
 * Coolify healthcheck target.
 *
 * Deliberately does not touch Redis: a Redis blip degrades rate limiting
 * (which fails open) but should not make the orchestrator kill the container.
 */
export function GET() {
  return new Response("ok\n", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
