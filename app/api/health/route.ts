import { rateLimitConfig } from "@/lib/api/rate-limit-config";

export const dynamic = "force-dynamic";

/**
 * Coolify healthcheck target.
 *
 * Deliberately does not touch Redis: a Redis blip degrades rate limiting
 * (which fails open) but should not make the orchestrator kill the container.
 *
 * It also advertises the rate-limit policy. The homepage is statically
 * prerendered, so anything it renders from the environment is baked at build
 * time — but RATE_LIMIT_MAX is a runtime variable, so the API info dialog
 * would happily state a limit the API is not actually enforcing. Reading it
 * from here instead keeps the two honest, and costs nothing because this
 * endpoint is exempt from the limit it describes.
 */
export function GET() {
  const { max, windowSec } = rateLimitConfig();

  return new Response("ok\n", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-RateLimit-Limit": String(max),
      "X-RateLimit-Window": String(windowSec),
    },
  });
}
