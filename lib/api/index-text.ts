import { SECTIONS, TOOLS, toolsInSection } from "@/lib/tools/registry";
import { curlExample } from "@/lib/tools/snippets";
import { SITE_URL } from "@/lib/site";

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
    "Every tool answers on a short path — /<tool> — and on the versioned",
    "/api/v1/<tool>. Both are the same endpoint; the versioned form is kept so a",
    "future /v2 can land without breaking anything.",
    "",
    "Plain text by default. Add ?format=json or ?format=xml for a machine-readable",
    "response, or send an Accept header of application/json or application/xml.",
    "Errors come back in the same format you asked for.",
    "",
    "Rate limited per IP; check X-RateLimit-Remaining and Retry-After.",
    "",
  ];

  for (const section of SECTIONS) {
    const tools = toolsInSection(section.id);
    if (tools.length === 0) continue;

    lines.push(`## ${section.name.toUpperCase()}`, "");

    for (const tool of tools) {
      const marker = tool.api.status === "live" ? "" : "  [not implemented yet]";
      lines.push(`  ${tool.api.method} /${tool.id}${marker}`);
      lines.push(`    ${tool.name} — ${tool.description}`);

      for (const param of tool.api.params) {
        const flag = param.required ? "required" : "optional";
        lines.push(`    - ${param.name} (${flag}): ${param.description}`);
      }

      lines.push(`    $ ${curlExample(tool)}`);
      lines.push("");
    }
  }

  const live = TOOLS.filter((tool) => tool.api.status === "live").length;
  lines.push(`${live} of ${TOOLS.length} endpoints implemented.`);

  return lines.join("\n");
}
