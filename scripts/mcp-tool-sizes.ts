/**
 * Prints every tool definition as tools/list really serves it, with its size.
 * Measured over serveMcp() rather than read from the code, so nothing the SDK
 * or the server adds on the way out can escape the count.
 *
 *   pnpm dlx tsx scripts/mcp-tool-sizes.ts            sizes, plus before/after
 *   pnpm dlx tsx scripts/mcp-tool-sizes.ts --full     the definitions as well
 *   pnpm dlx tsx scripts/mcp-tool-sizes.ts --record   rewrite the baseline
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { serveMcp } from "@/lib/mcp/server";

const BASELINE = resolve(__dirname, "mcp-tool-sizes.before.json");

type Definition = { name: string; description?: string; inputSchema: unknown };
type Size = { schema: number; description: number; total: number };

async function listTools(): Promise<Definition[]> {
  const response = await serveMcp(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }),
  );
  const payload = await response.json();
  return payload.result.tools;
}

function sizeOf(tool: Definition): Size {
  return {
    schema: JSON.stringify(tool.inputSchema).length,
    description: tool.description?.length ?? 0,
    total: JSON.stringify(tool).length,
  };
}

async function main() {
  const tools = await listTools();
  const sizes: Record<string, Size> = Object.fromEntries(tools.map((tool) => [tool.name, sizeOf(tool)]));

  if (process.argv.includes("--full")) {
    for (const tool of tools) console.log(JSON.stringify(tool));
    console.log();
  }

  if (process.argv.includes("--record")) {
    writeFileSync(BASELINE, `${JSON.stringify(sizes, null, 2)}\n`);
    console.log(`Recorded ${tools.length} tools.`);
  }

  const before: Record<string, Size> = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, "utf8"))
    : {};

  const sum = (rows: Size[], key: keyof Size) => rows.reduce((total, row) => total + row[key], 0);
  const row = (name: string, was: Partial<Size>, now: Size) =>
    [
      name.padEnd(22),
      `${was.schema ?? "-"}`.padStart(6),
      `${now.schema}`.padStart(6),
      `${was.description ?? "-"}`.padStart(6),
      `${now.description}`.padStart(6),
      `${was.total ?? "-"}`.padStart(6),
      `${now.total}`.padStart(6),
    ].join(" ");

  console.log(`${"tool".padEnd(22)}   schema       desc     definition`);
  console.log(`${"".padEnd(22)} before  after before  after before  after`);
  for (const [name, size] of Object.entries(sizes)) console.log(row(name, before[name] ?? {}, size));

  const rows = Object.values(before);
  const now = Object.values(sizes);
  console.log(
    row(
      "TOTAL",
      rows.length
        ? { schema: sum(rows, "schema"), description: sum(rows, "description"), total: sum(rows, "total") }
        : {},
      { schema: sum(now, "schema"), description: sum(now, "description"), total: sum(now, "total") },
    ),
  );
}

void main();
