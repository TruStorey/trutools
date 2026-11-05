import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ListToolsRequestSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { BadRequestError, HANDLERS } from "@/lib/api/handlers";
import { formatResult } from "@/lib/tools/format";
import { TOOLS, type ApiParam, type Tool } from "@/lib/tools/registry";
import { renderText } from "@/lib/tools/result";
import { SITE_URL } from "@/lib/site";

import { mcpDefinition } from "./definitions";
import { isMcpTool, mcpToolName } from "./names";

/**
 * The registry param that carries a body tool's document. The HTTP API reads
 * it from the raw request body; over MCP it arrives as an ordinary argument
 * and is handed to the handler as `body`, so requireBody() needs no changes.
 */
const BODY_PARAM = "body";

/**
 * Longest argument accepted, other than a body. On the HTTP API these all ride
 * in the URL, which Node caps at 16 KiB of headers, so this keeps a tool from
 * being handed far more over MCP than it can ever get from curl. A document
 * goes in `body`, which is bounded by the size of the request instead.
 */
export const MAX_ARGUMENT_LENGTH = 16 * 1024;

/** Every tool the MCP server exposes: an MCP tool that is wired up. */
export function mcpTools(): Tool[] {
  return TOOLS.filter((tool) => isMcpTool(tool) && HANDLERS[tool.id]);
}

type Args = Record<string, string | undefined>;

/** The registry's text for a parameter, minus what only makes sense to curl. */
function paramHelp(tool: Tool, param: ApiParam): string {
  return tool.bodyInput && param.name === BODY_PARAM
    ? param.description.replace(/,? (POSTed )?as the raw request body/, "")
    : param.description;
}

/**
 * Validates calls, and is never advertised: see lib/mcp/definitions.ts for that.
 *
 * Models send `32` and `true` as often as `"32"` and `"true"`, so any scalar
 * is accepted and stringified. From there the handlers parse it exactly as
 * they parse `?length=32`, so MCP gets the same validation and error messages
 * curl does. The full help text is here because a model that got this wrong
 * cannot read the slimmer definition any harder.
 */
function inputShape(tool: Tool) {
  return Object.fromEntries(
    tool.api.params.map((param) => {
      const help = paramHelp(tool, param);
      const field = z
        .union([z.string(), z.number(), z.boolean()], {
          error: (issue) =>
            issue.input === undefined
              ? `${param.name} is required. ${help}`
              : `${param.name} must be a string, number or boolean. ${help}`,
        })
        .transform(String)
        .refine(
          (value) =>
            (tool.bodyInput && param.name === BODY_PARAM) || value.length <= MAX_ARGUMENT_LENGTH,
          { error: `${param.name} must be ${MAX_ARGUMENT_LENGTH} characters or fewer.` },
        );
      return [param.name, param.required ? field : field.optional()];
    }),
  );
}

/** Title and annotations never reach the model, but clients act on them. */
function listEntry(tool: Tool) {
  return {
    name: mcpToolName(tool),
    title: tool.name,
    ...mcpDefinition(tool),
    annotations: {
      readOnlyHint: true,
      // DNS and mail lookups reach the outside world; the rest are pure.
      openWorldHint: Boolean(tool.serverOnly),
    },
  };
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
        "the generators.",
    },
  );

  for (const tool of mcpTools()) {
    const handler = HANDLERS[tool.id];

    server.registerTool(
      mcpToolName(tool),
      { inputSchema: inputShape(tool) },
      async (args: Args): Promise<CallToolResult> => {
        const params = new URLSearchParams();
        let body: string | null = null;

        for (const [name, value] of Object.entries(args)) {
          if (value === undefined) continue;
          if (tool.bodyInput && name === BODY_PARAM) body = value;
          else params.set(name, value);
        }

        // requireBody() would answer this with a curl command.
        if (tool.bodyInput && !body?.trim()) {
          const param = tool.api.params.find(({ name }) => name === BODY_PARAM);
          return errorResult(`body is required. ${param ? paramHelp(tool, param) : ""}`.trim());
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

  // Registered last, replacing the handler the SDK installs, because the SDK
  // generates its listing from the Zod shape. Calls still go through that shape.
  server.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: mcpTools().map(listEntry),
  }));

  return server;
}

/**
 * Answers one MCP HTTP request. Stateless: every POST gets a fresh server and
 * transport, so there is no session to pin to a replica behind Traefik. JSON
 * responses rather than SSE, because no tool streams progress.
 *
 * Shared by the /mcp route and its healthcheck, so the check exercises the
 * same path a client does.
 *
 * `parsedBody` is for a caller that has already read the request, as the route
 * has to in order to enforce its limits. Left undefined, the transport reads it.
 */
export async function serveMcp(request: Request, parsedBody?: unknown): Promise<Response> {
  const server = buildMcpServer(request);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request, { parsedBody });
  } finally {
    // JSON mode has already buffered the whole response by now.
    await server.close();
  }
}
