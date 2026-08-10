import { preflight } from "@/lib/api/respond";
import { handleToolRequest } from "@/lib/api/tool-route";

export const dynamic = "force-dynamic";

type RouteContext = {
  // Next 16: dynamic route params arrive as a Promise.
  params: Promise<{ tool: string }>;
};

/**
 * The versioned form. Kept alongside the short `/<tool>` alias so the original
 * shape never breaks and a future /v2 has an obvious place to live.
 */
export async function GET(request: Request, context: RouteContext) {
  const { tool } = await context.params;
  return handleToolRequest(request, tool);
}

export async function POST(request: Request, context: RouteContext) {
  const { tool } = await context.params;
  return handleToolRequest(request, tool);
}

export async function OPTIONS() {
  return preflight();
}
