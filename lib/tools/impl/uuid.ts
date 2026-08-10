import { ToolInputError, type ToolResult } from "../result";
import { randomBytes, toHex } from "./random";

export type UuidOptions = {
  version: 4 | 7;
  count: number;
  uppercase: boolean;
  hyphens: boolean;
};

export const UUID_DEFAULTS: UuidOptions = {
  version: 4,
  count: 1,
  uppercase: false,
  hyphens: true,
};

/**
 * UUIDv7: 48-bit big-endian Unix millisecond timestamp, then 74 bits of
 * randomness, with the version and variant nibbles overwritten (RFC 9562).
 * The leading timestamp is what makes these sort chronologically, which is why
 * they index far better than v4 as a primary key.
 */
function uuidV7(): string {
  const bytes = randomBytes(16);
  const now = BigInt(Date.now());

  for (let i = 0; i < 6; i += 1) {
    bytes[i] = Number((now >> BigInt(40 - i * 8)) & 0xffn);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const hex = toHex(bytes);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export function generateUuid(options: UuidOptions): ToolResult {
  if (options.count < 1 || options.count > 1000) {
    throw new ToolInputError("count must be between 1 and 1000");
  }
  if (options.version !== 4 && options.version !== 7) {
    throw new ToolInputError("version must be 4 or 7");
  }

  const lines: string[] = [];
  for (let i = 0; i < options.count; i += 1) {
    let value = options.version === 4 ? crypto.randomUUID() : uuidV7();
    if (options.uppercase) value = value.toUpperCase();
    if (!options.hyphens) value = value.replace(/-/g, "");
    lines.push(value);
  }

  return { kind: "lines", lines };
}
