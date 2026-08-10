/**
 * Where this deployment lives.
 *
 * One definition, used by the page metadata, the /api/v1 index, the error
 * messages that point people back at the docs, and every generated code
 * snippet — so moving domains is an env var rather than a grep.
 *
 * NEXT_PUBLIC_ because the snippets are built in the browser. Next inlines
 * these at build time, so changing it needs a rebuild, not just a restart —
 * which is what a Coolify redeploy does anyway.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://tools.truvibe.dev"
).replace(/\/+$/, "");

/** The same thing without the scheme, for prose and inline examples. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

export const API_BASE = `${SITE_URL}/api/v1`;
