import { NextResponse, type NextRequest } from "next/server";

import { TOOLS } from "@/lib/tools/registry";

const TOOL_IDS = new Set(TOOLS.map((tool) => tool.id));

/**
 * Serves the short `/<tool>` form by rewriting it onto the versioned route.
 *
 * Deliberately a rewrite here rather than an `app/[tool]/route.ts` catch-all.
 * A root-level dynamic route would swallow *every* unmatched path on the site,
 * so a mistyped URL in a browser would get a plain-text "No tool named ..."
 * instead of the 404 page — and `notFound()` inside a Route Handler returns an
 * empty body rather than rendering it, which is worse still.
 *
 * Matching against the known ids first means anything that is not a tool falls
 * through untouched and Next answers it exactly as it did before.
 */
export function middleware(request: NextRequest) {
  const segment = request.nextUrl.pathname.slice(1);

  if (!TOOL_IDS.has(segment)) return NextResponse.next();

  // Clone keeps the query string; a rewrite keeps the method and body, so
  // POST tools work through the short form too.
  const url = request.nextUrl.clone();
  url.pathname = `/api/v1/${segment}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Only single-segment paths can be a tool, and the framework's own routes
  // never should be — skipping them keeps middleware off the asset path.
  matcher: ["/((?!api/|_next/|icon\\.svg|favicon\\.ico).*)"],
};
