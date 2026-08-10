import { reportedIp } from "./client-ip";

export type HandlerContext = {
  request: Request;
  /** Query string parameters. */
  params: URLSearchParams;
  /** Raw request body for POST, or null for GET. */
  body: string | null;
};

export type ToolHandler = (ctx: HandlerContext) => string | Promise<string>;

/** Throw from a handler to return a 400 with a plain-text reason. */
export class BadRequestError extends Error {}

/**
 * Implemented tools, keyed by the id in lib/tools/registry.ts.
 *
 * Adding a tool is two edits: add a handler here, and flip that tool's
 * `api.status` to "live" in the registry. Anything in the registry without an
 * entry here is served as a 501 by app/api/v1/[tool]/route.ts.
 */
export const HANDLERS: Record<string, ToolHandler> = {
  ip: ({ request }) => reportedIp(request.headers),
};
