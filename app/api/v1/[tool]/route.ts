import { BadRequestError, HANDLERS } from "@/lib/api/handlers";
import { rateLimitKey } from "@/lib/api/client-ip";
import { rateLimit } from "@/lib/api/ratelimit";
import { failure, preflight, result, tooManyRequests } from "@/lib/api/respond";
import { resolveFormat } from "@/lib/tools/format";
import { getTool } from "@/lib/tools/registry";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

type RouteContext = {
  // Next 16: dynamic route params arrive as a Promise.
  params: Promise<{ tool: string }>;
};

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { tool: id } = await context.params;
  const url = new URL(request.url);

  // Resolved before anything else can fail, so even a 429 or a 404 comes back
  // in the format the caller asked for.
  const format = resolveFormat(url.searchParams, request.headers);

  // Rate limit before dispatch, so unimplemented endpoints are limited too and
  // cannot be used as a free way to probe the service.
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

export async function GET(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function OPTIONS() {
  return preflight();
}
