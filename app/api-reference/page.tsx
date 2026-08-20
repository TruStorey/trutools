import type { Metadata } from "next";

import { buildIndex } from "@/lib/api/index-text";

export const metadata: Metadata = {
  title: "API reference",
  description: "Every trutools endpoint, its parameters, and a curl example for each.",
};

/**
 * The browser's view of /api/v1.
 *
 * The proxy sends anything asking for HTML here, so the URL in the address bar
 * still reads /api/v1 and curl still gets text/plain from the route handler.
 * Same string either way — only the chrome around it differs, which is the
 * whole point: this is the reference, not a prettier rewrite of it.
 */
export default function ApiReferencePage() {
  return (
    // Same container as the tool grid on the home page, so the reference lines
    // up with the cards rather than sitting in a narrower column of its own.
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      {/*
        Wraps rather than scrolls. `pre-wrap` keeps the index's own line breaks
        and indentation but lets long lines fold, and `wrap-anywhere` is what
        actually deals with the JWT example — a single token with no spaces in
        it, which nothing else would find a break opportunity in.
      */}
      <pre className="font-mono text-xs leading-relaxed wrap-anywhere whitespace-pre-wrap text-foreground/80">
        {buildIndex()}
      </pre>
    </div>
  );
}
