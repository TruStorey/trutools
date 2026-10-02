import {
  getVerb,
  TOOLS,
  toolPath,
  toolsForVerb,
  VERBS,
  type Tool,
  type VerbId,
} from "@/lib/tools/registry";
import { curlExample } from "@/lib/tools/snippets";
import { MCP_URL } from "@/lib/mcp/names";
import { SITE_URL } from "@/lib/site";

/** One tool's entry, indented under its verb heading. */
function toolBlock(tool: Tool): string[] {
  const marker = tool.api.status === "live" ? "" : "  [not implemented yet]";
  const lines = [`  ${tool.api.method} /${toolPath(tool)}${marker}`];
  lines.push(`    ${tool.name} — ${tool.description}`);

  for (const param of tool.api.params) {
    const flag = param.required ? "required" : "optional";
    const bare = tool.api.bareParam === param.name ? ", name optional" : "";
    lines.push(`    - ${param.name} (${flag}${bare}): ${param.description}`);
  }

  lines.push(`    $ ${curlExample(tool)}`);
  lines.push("");
  return lines;
}

function verbBlock(verb: VerbId): string[] {
  const tools = toolsForVerb(verb);
  if (tools.length === 0) return [];

  const name = getVerb(verb)?.name ?? verb;
  return [`## ${name.toUpperCase()}`, "", ...tools.flatMap(toolBlock)];
}

/**
 * The self-documenting index, generated from the tool registry.
 *
 * Shared, because it is rendered twice from one source: /api/v1 serves it as
 * text/plain to anything that asks for it, and the proxy sends browsers to
 * /api-reference, which prints this same string inside the site chrome. The
 * two must never disagree, so neither owns it.
 */
export function buildIndex(): string {
  const lines: string[] = [
    "trutools API v1",
    SITE_URL,
    "",
    "Every tool answers on a short path — /<verb>/<tool> — and on the versioned",
    "/api/v1/<verb>/<tool>. Both are the same endpoint; the versioned form is kept",
    "so a future /v2 can land without breaking anything. A bare /<verb> lists the",
    "tools under it.",
    "",
    "Plain text by default. Add ?format=json or ?format=xml for a machine-readable",
    "response, or send an Accept header of application/json or application/xml.",
    "Errors come back in the same format you asked for.",
    "",
    "Some tools let you drop the name of their one required parameter, so",
    "/lookup/dns?example.com reads the same as /lookup/dns?name=example.com.",
    "Those parameters are marked below.",
    "",
    "Rate limited per IP; check X-RateLimit-Remaining and Retry-After.",
    "",
    `Also an MCP server, at ${MCP_URL} (Streamable HTTP).`,
    "Each tool below is an MCP tool named <verb>_<tool>, like lookup_dns, taking",
    "the same parameters.",
    "",
  ];

  for (const verb of VERBS) lines.push(...verbBlock(verb.id));

  const live = TOOLS.filter((tool) => tool.api.status === "live").length;
  lines.push(`${live} of ${TOOLS.length} endpoints implemented.`);

  return lines.join("\n");
}

/** What a bare /<verb> answers with. */
export function buildVerbIndex(verb: VerbId): string {
  const description = getVerb(verb)?.description ?? "";
  return [
    `trutools — /${verb}`,
    description,
    `Full list: ${SITE_URL}/api/v1`,
    "",
    ...verbBlock(verb),
  ].join("\n").trimEnd() + "\n";
}
