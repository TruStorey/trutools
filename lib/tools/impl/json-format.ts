import { ToolInputError, type ToolResult } from "../result";

export type JsonOptions = {
  input: string;
  /** Spaces per level. 0 minifies. */
  indent: number;
  /** Sort object keys alphabetically, recursively. */
  sort: boolean;
};

export const JSON_DEFAULTS: JsonOptions = {
  input: "",
  indent: 2,
  sort: false,
};

/**
 * Rebuilds the value with object keys in sorted order.
 *
 * JSON.stringify emits keys in insertion order, so sorting has to happen on the
 * value itself rather than in a replacer.
 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    entries.sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, item]) => [key, sortKeys(item)]));
  }

  return value;
}

export function formatJson(options: JsonOptions): ToolResult {
  const source = options.input.trim();
  if (!source) throw new ToolInputError("nothing to format");

  if (options.indent < 0 || options.indent > 8) {
    throw new ToolInputError("indent must be between 0 and 8");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    // SyntaxError from JSON.parse names the offending position, which is the
    // single most useful thing to hand back — so pass it through verbatim.
    throw new ToolInputError(
      error instanceof Error ? error.message : "input is not valid JSON",
    );
  }

  const value = options.sort ? sortKeys(parsed) : parsed;
  return { kind: "text", text: JSON.stringify(value, null, options.indent) };
}
