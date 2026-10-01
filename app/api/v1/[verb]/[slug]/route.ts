import { preflight } from "@/lib/api/respond";
import { handleToolRequest } from "@/lib/api/tool-route";

export const dynamic = "force-dynamic";

type RouteContext = {
  // Next 16: dynamic route params arrive as a Promise.
  params: Promise<{ verb: string; slug: string }>;
};

/**
 * The versioned form of /<verb>/<slug>. Kept alongside the short form so a
 * future /v2 has an obvious place to live.
 */
export async function GET(request: Request, context: RouteContext) {
  const { verb, slug } = await context.params;
  return handleToolRequest(request, verb, slug);
}

export async function POST(request: Request, context: RouteContext) {
  const { verb, slug } = await context.params;
  return handleToolRequest(request, verb, slug);
}

export async function OPTIONS() {
  return preflight();
}
