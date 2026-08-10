import { BadRequestError, HANDLERS } from "@/lib/api/handlers";
import { rateLimitKey } from "@/lib/api/client-ip";
import { rateLimit } from "@/lib/api/ratelimit";
import { preflight, text, tooManyRequests } from "@/lib/api/respond";
import { getTool } from "@/lib/tools/registry";

export const dynamic = "force-dynamic";

type RouteContext = {
  // Next 16: dynamic route params arrive as a Promise.
  params: Promise<{ tool: string }>;
};

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { tool: id } = await context.params;

  // Rate limit before dispatch, so unimplemented endpoints are limited too and
  // cannot be used as a free way to probe the service.
  const rate = await rateLimit(rateLimitKey(request.headers));
  if (!rate.ok) return tooManyRequests(rate);

  const tool = getTool(id);
  if (!tool) {
    return text(
      `404 Not Found\nNo tool named "${id}".\nSee https://trutools.truvibe.dev/api/v1 for the list of endpoints.`,
      { status: 404, rate },
    );
  }

  const handler = HANDLERS[id];
  if (!handler) {
    return text(
      `501 Not Implemented\n"${tool.name}" is not wired up yet.\n` +
        `See https://trutools.truvibe.dev/api/v1 for endpoints that are.`,
      { status: 501, rate },
    );
  }

  const url = new URL(request.url);
  const body = request.method === "POST" ? await request.text() : null;

  try {
    const result = await handler({ request, params: url.searchParams, body });
    return text(result, { rate });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return text(`400 Bad Request\n${error.message}`, { status: 400, rate });
    }
    console.error(`[trutools] handler "${id}" failed:`, error);
    return text("500 Internal Server Error", { status: 500, rate });
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
