import { ToolInputError, type ToolResult } from "../result";
import { randomBytes, toBase58, toBase64Url, toHex } from "./random";

export type TokenEncoding = "base64url" | "hex" | "base58";

export type TokenOptions = {
  bytes: number;
  encoding: TokenEncoding;
  prefix: string;
  count: number;
};

export const TOKEN_DEFAULTS: TokenOptions = {
  bytes: 32,
  encoding: "base64url",
  prefix: "",
  count: 1,
};

export function generateToken(options: TokenOptions): ToolResult {
  if (options.bytes < 8 || options.bytes > 256) {
    throw new ToolInputError("bytes must be between 8 and 256");
  }
  if (options.count < 1 || options.count > 100) {
    throw new ToolInputError("count must be between 1 and 100");
  }

  const lines: string[] = [];

  for (let i = 0; i < options.count; i += 1) {
    const raw = randomBytes(options.bytes);

    let encoded: string;
    switch (options.encoding) {
      case "hex":
        encoded = toHex(raw);
        break;
      case "base58":
        encoded = toBase58(raw);
        break;
      default:
        encoded = toBase64Url(raw);
    }

    // A prefix like `sk_live` makes a leaked key greppable in logs and lets
    // secret scanners recognise it — the reason Stripe and GitHub do this.
    lines.push(options.prefix ? `${options.prefix}_${encoded}` : encoded);
  }

  return { kind: "lines", lines };
}
