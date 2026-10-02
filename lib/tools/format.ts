import { renderText, type ToolResult } from "./result";

export const API_FORMATS = ["text", "json", "xml"] as const;
export type ApiFormat = (typeof API_FORMATS)[number];

export function isApiFormat(value: string): value is ApiFormat {
  return (API_FORMATS as readonly string[]).includes(value);
}

export const CONTENT_TYPES: Record<ApiFormat, string> = {
  text: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
};

/**
 * "SHA-256 fingerprint" -> "sha_256_fingerprint".
 *
 * Human labels are what the text format prints, but they are useless as JSON
 * keys or XML element names, so machine formats get a slug instead. The
 * original label is preserved as an XML attribute so nothing is lost.
 */
export function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  // XML element names cannot start with a digit.
  return /^[0-9]/.test(slug) ? `_${slug}` : slug || "field";
}

/**
 * Slugs for a set of labels, suffixed where they repeat: ["Unit", "Unit"] ->
 * ["unit", "unit_2"]. JSON object keys must be unique, and a repeated key
 * silently drops every value but the last.
 */
function uniqueSlugs(labels: string[]): string[] {
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const slug = slugify(label);
    const count = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, count);
    return count === 1 ? slug : `${slug}_${count}`;
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toJson(tool: string, result: ToolResult): string {
  let payload: unknown;
  let note: string | undefined;

  switch (result.kind) {
    case "lines":
      payload = result.lines;
      break;
    case "text":
      payload = result.text;
      break;
    case "rows": {
      const keys = uniqueSlugs(result.columns);
      payload = result.rows.map((row) =>
        Object.fromEntries(keys.map((key, index) => [key, row[index] ?? ""])),
      );
      note = result.note;
      break;
    }
    case "fields": {
      const keys = uniqueSlugs(result.fields.map((field) => field.label));
      payload = Object.fromEntries(
        result.fields.map((field, index) => [keys[index], field.value]),
      );
      break;
    }
  }

  return JSON.stringify(note ? { tool, result: payload, note } : { tool, result: payload }, null, 2);
}

function toXml(tool: string, result: ToolResult): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<trutools tool="${escapeXml(tool)}">`,
  ];

  switch (result.kind) {
    case "lines":
      for (const line of result.lines) {
        lines.push(`  <item>${escapeXml(line)}</item>`);
      }
      break;
    case "text":
      lines.push(`  <result>${escapeXml(result.text)}</result>`);
      break;
    case "rows": {
      const keys = result.columns.map(slugify);
      for (const row of result.rows) {
        lines.push("  <row>");
        keys.forEach((key, index) => {
          lines.push(
            `    <${key} label="${escapeXml(result.columns[index])}">${escapeXml(row[index] ?? "")}</${key}>`,
          );
        });
        lines.push("  </row>");
      }
      if (result.note) lines.push(`  <note>${escapeXml(result.note)}</note>`);
      break;
    }
    case "fields":
      for (const field of result.fields) {
        const name = slugify(field.label);
        lines.push(
          `  <${name} label="${escapeXml(field.label)}">${escapeXml(field.value)}</${name}>`,
        );
      }
      break;
  }

  lines.push("</trutools>");
  return lines.join("\n");
}

/** Renders a tool result in the requested format. */
export function formatResult(tool: string, result: ToolResult, format: ApiFormat): string {
  switch (format) {
    case "json":
      return toJson(tool, result);
    case "xml":
      return toXml(tool, result);
    default:
      return renderText(result);
  }
}

/** Errors follow the same format as a success would, so clients can parse either. */
export function formatError(message: string, status: number, format: ApiFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify({ error: message, status }, null, 2);
    case "xml":
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<error status="${status}">${escapeXml(message)}</error>`,
      ].join("\n");
    default:
      return message;
  }
}

/**
 * `?format=` wins; otherwise a JSON or XML Accept header is honoured, so a
 * library that sets Accept by default gets something it can parse. Anything
 * else falls back to plain text.
 */
export function resolveFormat(params: URLSearchParams, headers: Headers): ApiFormat {
  const requested = params.get("format")?.trim().toLowerCase();
  if (requested && isApiFormat(requested)) return requested;

  const accept = headers.get("accept")?.toLowerCase() ?? "";
  if (accept.includes("application/json")) return "json";
  if (accept.includes("application/xml") || accept.includes("text/xml")) return "xml";

  return "text";
}
