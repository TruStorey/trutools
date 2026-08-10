import { ToolInputError, type ToolResult } from "../result";

export const TEXT_OPERATIONS = [
  "join",
  "split",
  "trim",
  "dedupe",
  "sort",
  "reverse",
  "count",
] as const;

export type TextOperation = (typeof TEXT_OPERATIONS)[number];

export type TextOptions = {
  input: string;
  operation: TextOperation;
  /** Separator for join and split. Supports \n and \t escapes. */
  separator: string;
  /** Drop empty lines before operating. */
  dropEmpty: boolean;
};

export const TEXT_DEFAULTS: TextOptions = {
  input: "",
  operation: "join",
  separator: ",",
  dropEmpty: true,
};

/** Lets the separator field carry \n and \t, which cannot be typed into it. */
function unescape(separator: string): string {
  return separator
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r");
}

function toLines(input: string, dropEmpty: boolean): string[] {
  const lines = input.split(/\r?\n/);
  return dropEmpty ? lines.filter((line) => line.trim() !== "") : lines;
}

export function transformText(options: TextOptions): ToolResult {
  if (!options.input.trim()) throw new ToolInputError("nothing to transform");

  if (!TEXT_OPERATIONS.includes(options.operation)) {
    throw new ToolInputError(
      `unknown operation "${options.operation}" — expected one of ${TEXT_OPERATIONS.join(", ")}`,
    );
  }

  const separator = unescape(options.separator);
  const lines = toLines(options.input, options.dropEmpty);

  switch (options.operation) {
    case "join":
      return { kind: "text", text: lines.map((line) => line.trim()).join(separator) };

    case "split": {
      if (!separator) throw new ToolInputError("split needs a separator");
      const parts = options.input
        .split(separator)
        .map((part) => part.trim())
        .filter((part) => (options.dropEmpty ? part !== "" : true));
      return { kind: "lines", lines: parts };
    }

    case "trim":
      return { kind: "lines", lines: lines.map((line) => line.trim()) };

    case "dedupe": {
      // Set preserves first-seen order, which is what people expect from a
      // dedupe that is not also a sort.
      const seen = [...new Set(lines.map((line) => line.trim()))];
      return { kind: "lines", lines: seen };
    }

    case "sort":
      return {
        kind: "lines",
        lines: [...lines]
          .map((line) => line.trim())
          .sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
      };

    case "reverse":
      return { kind: "lines", lines: [...lines].reverse() };

    case "count": {
      const words = options.input.trim().split(/\s+/).filter(Boolean);
      return {
        kind: "fields",
        fields: [
          { label: "Lines", value: String(lines.length) },
          { label: "Words", value: String(words.length) },
          { label: "Characters", value: String(options.input.length) },
          {
            label: "Characters (no spaces)",
            value: String(options.input.replace(/\s/g, "").length),
          },
          { label: "Unique lines", value: String(new Set(lines.map((l) => l.trim())).size) },
        ],
      };
    }
  }
}
