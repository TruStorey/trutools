import { resolveFormat } from "@/lib/tools/format";
import { getTool } from "@/lib/tools/registry";
import { SITE_URL } from "@/lib/site";

import { rateLimitKey } from "./client-ip";
import { BadRequestError, HANDLERS } from "./handlers";
import { rateLimit } from "./ratelimit";
import { failure, result, tooManyRequests } from "./respond";

/**
 * The tool dispatch, shared by both routes that expose it:
 *
 *   /<tool>          the short form the snippets promote, rewritten onto the
 *                    route below by proxy.ts
 *   /api/v1/<tool>   the versioned form, kept so a future /v2 has somewhere to
 *                    live and the old shape never breaks
 *
 * The rewrite means there is one implementation, so rate limiting, formats and
 * error bodies cannot drift between the two paths.
 */
export async function handleToolRequest(request: Request, id: string): Promise<Response> {
  const url = new URL(request.url);

  // Resolved before anything else can fail, so even a 429 or a 404 comes back
  // in the format the caller asked for.
  const format = resolveFormat(url.searchParams, request.headers);

  // Rate limit before dispatch, so unknown and unimplemented endpoints are
  // limited too and cannot be used as a free way to probe the service.
  const rate = await rateLimit(rateLimitKey(request.headers));
  if (!rate.ok) return tooManyRequests(rate, format);

  const tool = getTool(id);
  if (!tool) {
    return failure(
      `No tool named "${id}". See ${SITE_URL}/api/v1 for the list of endpoints.`,
      404,
      format,
      rate,
    );
  }

  const handler = HANDLERS[id];
  if (!handler) {
    return failure(
      `"${tool.name}" is not wired up yet. See ${SITE_URL}/api/v1 for endpoints that are.`,
      501,
      format,
      rate,
    );
  }

  const requestBody = request.method === "POST" ? await request.text() : null;

  try {
    const value = await handler({ request, params: url.searchParams, body: requestBody });
    return result(id, value, format, rate);
  } catch (error) {
    if (error instanceof BadRequestError) {
      return failure(error.message, 400, format, rate);
    }
    console.error(`[trutools] handler "${id}" failed:`, error);
    return failure("Internal Server Error", 500, format, rate);
  }
}
