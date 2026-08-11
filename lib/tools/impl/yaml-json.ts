import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { ToolInputError, type ToolResult } from "../result";

export type YamlJsonDirection = "auto" | "json" | "yaml";

export type YamlJsonOptions = {
  input: string;
  /** What to produce. "auto" converts to whichever the input is not. */
  to: YamlJsonDirection;
  indent: number;
};

export const YAML_JSON_DEFAULTS: YamlJsonOptions = {
  input: "",
  to: "auto",
  indent: 2,
};

/**
 * JSON is a subset of YAML, so a YAML parser accepts both and "is this JSON"
 * cannot be answered by parsing. The shape of the text is the only signal:
 * a document starting with { or [ is being written as JSON.
 */
function looksLikeJson(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

export function convertYamlJson(options: YamlJsonOptions): ToolResult {
  const input = options.input.trim();
  if (!input) throw new ToolInputError("nothing to convert");

  if (options.indent < 0 || options.indent > 8) {
    throw new ToolInputError("indent must be between 0 and 8");
  }

  const target = options.to === "auto" ? (looksLikeJson(input) ? "yaml" : "json") : options.to;

  let parsed: unknown;
  try {
    // Handles JSON too, being a superset of it.
    parsed = parseYaml(input);
  } catch (error) {
    // The yaml package reports the line and column, which is the useful part.
    throw new ToolInputError(
      error instanceof Error ? error.message.split("\n")[0] : "input is not valid YAML or JSON",
    );
  }

  if (parsed === undefined) throw new ToolInputError("input parsed to nothing");

  const text =
    target === "json"
      ? JSON.stringify(parsed, null, options.indent)
      : stringifyYaml(parsed, { indent: Math.max(1, options.indent) });

  return { kind: "text", text: text.replace(/\n$/, "") };
}
