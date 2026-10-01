import { NextResponse, type NextRequest } from "next/server";

import { isVerb, TOOLS, toolPath } from "@/lib/tools/registry";

const TOOL_PATHS = new Set(TOOLS.map(toolPath));

function wantsHtml(request: NextRequest): boolean {
  return request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
}

/**
 * Serves the short `/<verb>/<slug>` form by rewriting it onto the versioned
 * route, and a bare `/<verb>` onto its plain-text index.
 *
 * This is Next 16's `proxy` convention — the old `middleware.ts` name is
 * deprecated; same execution model, different file and export name.
 *
 * Deliberately a rewrite here rather than an `app/[verb]/[slug]/route.ts`
 * catch-all. A root-level dynamic route would swallow *every* unmatched path,
 * so a mistyped URL in a browser would get a plain-text "No tool at ..."
 * instead of the 404 page — and `notFound()` inside a Route Handler returns an
 * empty body rather than rendering it, which is worse still.
 *
 * Matching against the known paths first means anything that is not a tool
 * falls through untouched and Next answers it — with the 404 page, since
 * app/[verb] only exists for real verbs.
 */
export function proxy(request: NextRequest) {
  // The index is the one endpoint with a human audience as well as a machine
  // one. A browser asking for HTML gets the page; everything else — curl,
  // scripts, anything sending */* — falls through to the text/plain handler,
  // so the URL people copy out of the docs keeps behaving exactly as it did.
  if (request.nextUrl.pathname === "/api/v1") {
    if (!wantsHtml(request)) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = "/api-reference";
    return NextResponse.rewrite(url);
  }

  const path = request.nextUrl.pathname.slice(1);
  const segments = path.split("/");
  const underVerb = isVerb(segments[0]) && segments.length <= 2;

  // Known tools always go to the API, whoever is asking. Anything else under a
  // verb — the bare verb, or a mistyped slug — works the same way round as the
  // index: browsers get the page (or the 404 page), everything else the API's
  // plain-text answer.
  if (!TOOL_PATHS.has(path) && !(underVerb && !wantsHtml(request))) {
    return NextResponse.next();
  }

  // Clone keeps the query string; a rewrite keeps the method and body, so
  // POST tools work through the short form too.
  const url = request.nextUrl.clone();
  url.pathname = `/api/v1/${path}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // The framework's own routes are never a tool — skipping them keeps this
    // off the asset path entirely.
    "/((?!api/|_next/|icon\\.svg|favicon\\.ico).*)",
    // Added back on its own, because the pattern above deliberately excludes
    // everything under /api/.
    "/api/v1",
  ],
};
