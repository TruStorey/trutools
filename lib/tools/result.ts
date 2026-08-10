/**
 * The shape every tool returns.
 *
 * Both the interactive panel and the API render from this, so the browser and
 * `curl` can never drift apart — there is exactly one computation and one
 * result per tool.
 */
export type ToolResult =
  /** A list of independent values: 5 UUIDs, 3 passwords. */
  | { kind: "lines"; lines: string[] }
  /** Labelled readings: subnet maths, certificate contents, timestamps. */
  | { kind: "fields"; fields: { label: string; value: string }[] }
  /** One blob, meant to be copied whole: formatted JSON, transformed text. */
  | { kind: "text"; text: string };

/** Thrown by a tool for bad input. Surfaced as a 400 by the API. */
export class ToolInputError extends Error {}

/** Flattens a result to the plain text the API returns. */
export function renderText(result: ToolResult): string {
  switch (result.kind) {
    case "lines":
      return result.lines.join("\n");
    case "text":
      return result.text;
    case "fields": {
      const isMultiline = (value: string) => value.includes("\n");

      // Only single-line values take part in the column, so one long PEM block
      // does not push every other label halfway across the terminal.
      const singleLine = result.fields.filter((field) => !isMultiline(field.value));
      const width = singleLine.length
        ? Math.max(...singleLine.map((field) => field.label.length))
        : 0;

      const lines: string[] = [];

      for (const field of result.fields) {
        if (isMultiline(field.value)) {
          // Multi-line values get their own flush-left block. Indenting them
          // to match the column would look tidier but would corrupt the
          // content — an indented PEM body is not a key ssh-keygen will load,
          // and `curl ... > id_ed25519` has to just work.
          lines.push("", `${field.label}:`, field.value);
        } else {
          lines.push(`${field.label.padEnd(width)}  ${field.value}`);
        }
      }

      return lines.join("\n").trim();
    }
  }
}

/** Everything a result contains, as one copyable string. */
export function resultToClipboard(result: ToolResult): string {
  return renderText(result);
}
