import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { BadRequestError, HANDLERS } from "@/lib/api/handlers";
import { formatResult } from "@/lib/tools/format";
import { TOOLS, type Tool } from "@/lib/tools/registry";
import { renderText } from "@/lib/tools/result";
import { SITE_URL } from "@/lib/site";

import { isMcpTool, mcpToolName } from "./names";

/**
 * The registry param that carries a body tool's document. The HTTP API reads
 * it from the raw request body; over MCP it arrives as an ordinary argument
 * and is handed to the handler as `body`, so requireBody() needs no changes.
 */
const BODY_PARAM = "body";

/** Every tool the MCP server exposes: an MCP tool that is wired up. */
export function mcpTools(): Tool[] {
  return TOOLS.filter((tool) => isMcpTool(tool) && HANDLERS[tool.id]);
}

/**
 * Models send `32` and `true` as often as `"32"` and `"true"`, so any scalar
 * is accepted and stringified. From there the handlers parse it exactly as
 * they parse `?length=32`, so MCP gets the same validation and error messages
 * curl does.
 */
const scalar = z.union([z.string(), z.number(), z.boolean()]).transform(String);

type Args = Record<string, string | undefined>;

function inputShape(tool: Tool) {
  return Object.fromEntries(
    tool.api.params.map((param) => {
      // "The JSON document, POSTed as the raw request body." describes curl,
      // not MCP, where it is just another argument.
      const text =
        tool.bodyInput && param.name === BODY_PARAM
          ? param.description.replace(/,? (POSTed )?as the raw request body/, "")
          : param.description;
      const field = scalar.describe(text);
      return [param.name, param.required ? field : field.optional()];
    }),
  );
}

function description(tool: Tool): string {
  const parts = [tool.description];
  if (tool.api.note) parts.push(tool.api.note);
  return parts.join("\n\n");
}

function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/**
 * A fresh server per request: the endpoint is stateless, so there is nothing
 * to share between calls and no session to keep behind the proxy.
 *
 * `request` is the incoming HTTP request, passed through to the handlers in
 * the same HandlerContext shape the API route builds.
 */
export function buildMcpServer(request: Request): McpServer {
  const server = new McpServer(
    { name: "trutools", version: "1.0.0", websiteUrl: SITE_URL },
    {
      instructions:
        "Developer and sysadmin utilities: generators, decoders, DNS and mail lookups, " +
        "subnet maths, format converters and linters. Every tool is deterministic except " +
        "the generators. All arguments are strings, exactly as the HTTP API's query parameters.",
    },
  );

  for (const tool of mcpTools()) {
    const handler = HANDLERS[tool.id];

    server.registerTool(
      mcpToolName(tool),
      {
        title: tool.name,
        description: description(tool),
        inputSchema: inputShape(tool),
        annotations: {
          readOnlyHint: true,
          // DNS and mail lookups reach the outside world; the rest are pure.
          openWorldHint: Boolean(tool.serverOnly),
        },
      },
      async (args: Args): Promise<CallToolResult> => {
        const params = new URLSearchParams();
        let body: string | null = null;

        for (const [name, value] of Object.entries(args)) {
          if (value === undefined) continue;
          if (tool.bodyInput && name === BODY_PARAM) body = value;
          else params.set(name, value);
        }

        try {
          const value = await handler({ request, params, body });
          return {
            content: [{ type: "text", text: renderText(value) }],
            structuredContent: JSON.parse(formatResult(tool.id, value, "json")),
          };
        } catch (error) {
          if (error instanceof BadRequestError) return errorResult(error.message);
          console.error(`[trutools] mcp tool "${tool.id}" failed:`, error);
          return errorResult("Internal Server Error");
        }
      },
    );
  }

  return server;
}

/**
 * Answers one MCP HTTP request. Stateless: every POST gets a fresh server and
 * transport, so there is no session to pin to a replica behind Traefik. JSON
 * responses rather than SSE, because no tool streams progress.
 *
 * Shared by the /mcp route and its healthcheck, so the check exercises the
 * same path a client does.
 */
export async function serveMcp(request: Request): Promise<Response> {
  const server = buildMcpServer(request);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally {
    // JSON mode has already buffered the whole response by now.
    await server.close();
  }
}
