import { ToolInputError, type ToolResult } from "../result";

export type Base64Mode = "auto" | "encode" | "decode";

export type Base64Options = {
  input: string;
  mode: Base64Mode;
  /** Use the URL-safe alphabet (-_ instead of +/) and drop padding. */
  urlSafe: boolean;
};

export const BASE64_DEFAULTS: Base64Options = {
  input: "",
  mode: "auto",
  urlSafe: false,
};

/** Control characters that text does not contain: everything but tab, LF, CR. */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

function encode(input: string, urlSafe: boolean): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary);
  return urlSafe ? encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : encoded;
}

function decode(input: string): string {
  // Accept either alphabet, and tolerate missing padding.
  const normalised = input.trim().replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");

  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new ToolInputError("not valid base64");
  }

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  // fatal, so bytes that are not UTF-8 are reported rather than quietly
  // becoming replacement characters.
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ToolInputError(
      "decodes to bytes that are not valid UTF-8 text — this looks like binary, not a string",
    );
  }
}

/**
 * Whether the input looks like something already encoded.
 *
 * A guess, and it has to be: "test" is valid base64 that decodes to three
 * meaningless bytes. Requiring the decoded form to be printable text catches
 * that. `mode=` forces the direction when the guess is not wanted.
 */
function looksEncoded(input: string): boolean {
  const trimmed = input.trim().replace(/\s+/g, "");
  if (trimmed.length < 4 || trimmed.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/\-_]+={0,2}$/.test(trimmed)) return false;

  try {
    const decoded = decode(trimmed);
    return decoded.length > 0 && !CONTROL_CHARACTERS.test(decoded);
  } catch {
    return false;
  }
}

function run(options: Base64Options): { mode: "encode" | "decode"; text: string } {
  if (!options.input.trim()) throw new ToolInputError("nothing to convert");

  const mode =
    options.mode === "auto" ? (looksEncoded(options.input) ? "decode" : "encode") : options.mode;

  return {
    mode,
    text: mode === "decode" ? decode(options.input) : encode(options.input, options.urlSafe),
  };
}

/**
 * Auto mode reports which direction it chose, so a wrong guess is visible.
 * An explicit mode returns the bare value, because at that point the caller
 * knows what they asked for and probably wants to pipe it.
 */
export function convertBase64(options: Base64Options): ToolResult {
  const { mode, text } = run(options);

  if (options.mode !== "auto") return { kind: "text", text };

  return {
    kind: "fields",
    fields: [
      { label: "Direction", value: `${mode}d (auto-detected)` },
      { label: "Result", value: text },
    ],
  };
}
