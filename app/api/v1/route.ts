import { rateLimitKey } from "@/lib/api/client-ip";
import { rateLimit } from "@/lib/api/ratelimit";
import { preflight, text, tooManyRequests } from "@/lib/api/respond";
import { SECTIONS, TOOLS, toolsInSection } from "@/lib/tools/registry";

export const dynamic = "force-dynamic";

/** Self-documenting plain-text index, generated from the tool registry. */
function buildIndex(): string {
  const lines: string[] = [
    "trutools API v1",
    "https://trutools.truvibe.dev",
    "",
    "Plain text in, plain text out. Every response is text/plain and ends in a newline.",
    "Rate limited per IP; check X-RateLimit-Remaining and Retry-After.",
    "",
  ];

  for (const section of SECTIONS) {
    const tools = toolsInSection(section.id);
    if (tools.length === 0) continue;

    lines.push(`## ${section.name.toUpperCase()}`, "");

    for (const tool of tools) {
      const marker = tool.api.status === "live" ? "" : "  [not implemented yet]";
      lines.push(`  GET /api/v1/${tool.id}${marker}`);
      lines.push(`    ${tool.name} — ${tool.description}`);

      for (const param of tool.api.params) {
        const flag = param.required ? "required" : "optional";
        lines.push(`    - ${param.name} (${flag}): ${param.description}`);
      }

      lines.push(`    $ ${tool.api.example}`);
      lines.push("");
    }
  }

  const live = TOOLS.filter((tool) => tool.api.status === "live").length;
  lines.push(`${live} of ${TOOLS.length} endpoints implemented.`);

  return lines.join("\n");
}

export async function GET(request: Request) {
  const rate = await rateLimit(rateLimitKey(request.headers));
  if (!rate.ok) return tooManyRequests(rate);

  return text(buildIndex(), { rate });
}

export async function OPTIONS() {
  return preflight();
}
