import { NextResponse, type NextRequest } from "next/server";

import { TOOLS } from "@/lib/tools/registry";

const TOOL_IDS = new Set(TOOLS.map((tool) => tool.id));

/**
 * Serves the short `/<tool>` form by rewriting it onto the versioned route.
 *
 * This is Next 16's `proxy` convention — the old `middleware.ts` name is
 * deprecated; same execution model, different file and export name.
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
export function proxy(request: NextRequest) {
  // The index is the one endpoint with a human audience as well as a machine
  // one. A browser asking for HTML gets the page; everything else — curl,
  // scripts, anything sending */* — falls through to the text/plain handler,
  // so the URL people copy out of the docs keeps behaving exactly as it did.
  if (request.nextUrl.pathname === "/api/v1") {
    const wantsHtml =
      request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");

    if (!wantsHtml) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = "/api-reference";
    return NextResponse.rewrite(url);
  }

  const segment = request.nextUrl.pathname.slice(1);

  if (!TOOL_IDS.has(segment)) return NextResponse.next();

  // Clone keeps the query string; a rewrite keeps the method and body, so
  // POST tools work through the short form too.
  const url = request.nextUrl.clone();
  url.pathname = `/api/v1/${segment}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Only single-segment paths can be a tool, and the framework's own routes
    // never should be — skipping them keeps this off the asset path entirely.
    "/((?!api/|_next/|icon\\.svg|favicon\\.ico).*)",
    // Added back on its own, because the pattern above deliberately excludes
    // everything under /api/.
    "/api/v1",
  ],
};
