/**
 * MCP naming, kept free of the SDK and the handlers so client components can
 * import it. The server and the UI both read names from here, so the name a
 * tool's API tab shows is the name tools/list returns.
 */
import { toolPath, type Tool } from "@/lib/tools/registry";
import { SITE_URL } from "@/lib/site";

export const MCP_URL = `${SITE_URL}/mcp`;

/**
 * Tools that make no sense over MCP. `ip` answers with the caller's address,
 * and the caller here is the MCP client's host — not the person asking.
 */
const EXCLUDED = new Set(["ip"]);

/** `lookup/dns` → `lookup_dns`. Verb + slug is unique, so the name is too. */
export function mcpToolName(tool: Tool): string {
  return toolPath(tool).replace(/[/-]/g, "_");
}

/** Live and meaningful remotely. The server also requires a handler. */
export function isMcpTool(tool: Tool): boolean {
  return tool.api.status === "live" && !EXCLUDED.has(tool.id);
}
