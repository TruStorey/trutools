import { ToolInputError, type ToolResult } from "../result";

export const CASE_STYLES = [
  "camel",
  "pascal",
  "snake",
  "kebab",
  "constant",
  "title",
  "sentence",
  "dot",
  "path",
  "lower",
  "upper",
] as const;

export type CaseStyle = (typeof CASE_STYLES)[number];

const LABELS: Record<CaseStyle, string> = {
  camel: "camelCase",
  pascal: "PascalCase",
  snake: "snake_case",
  kebab: "kebab-case",
  constant: "CONSTANT_CASE",
  title: "Title Case",
  sentence: "Sentence case",
  dot: "dot.case",
  path: "path/case",
  lower: "lowercase",
  upper: "UPPERCASE",
};

/**
 * Splits any of the supported forms into plain words.
 *
 * The awkward part is acronyms: "parseHTTPResponse" has to become
 * [parse, HTTP, Response] rather than [parse, H, T, T, P, Response], so an
 * uppercase run is only broken where it is followed by a lowercase letter.
 *
 * That makes single-letter words lossy, and unavoidably so: "a.b.c" becomes
 * "aBC" in camelCase, and "aBC" reads back as [a, BC] rather than [a, b, c].
 * Both readings are legitimate; treating a capital run as an acronym is the
 * one that keeps HTTPResponse intact, which matters far more often.
 */
export function toWords(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_\-./\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

export function toCase(input: string, style: CaseStyle): string {
  const words = toWords(input);
  if (words.length === 0) return "";

  switch (style) {
    case "camel":
      return words
        .map((word, index) => (index === 0 ? word.toLowerCase() : capitalise(word)))
        .join("");
    case "pascal":
      return words.map(capitalise).join("");
    case "snake":
      return words.map((word) => word.toLowerCase()).join("_");
    case "kebab":
      return words.map((word) => word.toLowerCase()).join("-");
    case "constant":
      return words.map((word) => word.toUpperCase()).join("_");
    case "title":
      return words.map(capitalise).join(" ");
    case "sentence":
      return capitalise(words.join(" "));
    case "dot":
      return words.map((word) => word.toLowerCase()).join(".");
    case "path":
      return words.map((word) => word.toLowerCase()).join("/");
    case "lower":
      return words.join(" ").toLowerCase();
    case "upper":
      return words.join(" ").toUpperCase();
  }
}

export type CaseOptions = {
  input: string;
  /** One style, or undefined for all of them. */
  style?: CaseStyle;
};

export function convertCase(options: CaseOptions): ToolResult {
  if (!options.input.trim()) throw new ToolInputError("nothing to convert");

  if (options.style) {
    return { kind: "text", text: toCase(options.input, options.style) };
  }

  return {
    kind: "fields",
    fields: CASE_STYLES.map((style) => ({
      label: LABELS[style],
      value: toCase(options.input, style),
    })),
  };
}
