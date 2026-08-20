import { resolveFormat } from "@/lib/tools/format";
import { getTool, type Tool } from "@/lib/tools/registry";
import { SITE_URL } from "@/lib/site";

import { rateLimitKey } from "./client-ip";
import { BadRequestError, HANDLERS } from "./handlers";
import { rateLimit } from "./ratelimit";
import { failure, result, tooManyRequests } from "./respond";

/** Query parameters every tool understands, whatever its own list says. */
const GLOBAL_PARAMS = new Set(["format"]);

/**
 * Lets the one required parameter be given without its name, so
 * `?example.com` reads the same as `?name=example.com`.
 *
 * A bare value arrives as a key with an empty value — `?example.com` parses to
 * ("example.com", "") — so the rule is: the first entry with no value whose key
 * is not a parameter this tool already knows about. Anything the tool does name
 * is left alone, which is what keeps `?format=json` and `?type=A` working
 * alongside it.
 *
 * Opt-in per tool via `api.bareParam`, never blanket: see the note on that
 * field for why a value containing `=`, `&` or `+` cannot survive the trip.
 */
function promoteBareParam(params: URLSearchParams, tool: Tool): URLSearchParams {
  const bare = tool.api.bareParam;
  if (!bare) return params;

  // An explicit ?name= always wins; nothing is guessed over the top of it.
  if (params.get(bare)) return params;

  const named = new Set(tool.api.params.map((param) => param.name));

  for (const [key, value] of params) {
    if (value !== "" || named.has(key) || GLOBAL_PARAMS.has(key)) continue;

    const promoted = new URLSearchParams(params);
    promoted.delete(key);
    promoted.set(bare, key);
    return promoted;
  }

  return params;
}

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
    const params = promoteBareParam(url.searchParams, tool);
    const value = await handler({ request, params, body: requestBody });
    return result(id, value, format, rate);
  } catch (error) {
    if (error instanceof BadRequestError) {
      return failure(error.message, 400, format, rate);
    }
    console.error(`[trutools] handler "${id}" failed:`, error);
    return failure("Internal Server Error", 500, format, rate);
  }
}
