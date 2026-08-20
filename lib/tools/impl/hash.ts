import { ToolInputError, type ToolResult } from "../result";
import { md5 } from "./md5";

export const HASH_ALGORITHMS = ["md5", "sha1", "sha256", "sha512"] as const;
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

const SUBTLE_NAMES: Record<Exclude<HashAlgorithm, "md5">, string> = {
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha512: "SHA-512",
};

const LABELS: Record<HashAlgorithm, string> = {
  md5: "MD5",
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha512: "SHA-512",
};

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Async because crypto.subtle.digest is. Isomorphic: the same WebCrypto lives
 * on globalThis in the browser and in Node 24, so the panel and the route
 * handler run this identical function.
 */
export async function hashOne(input: string, algorithm: HashAlgorithm): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  if (algorithm === "md5") return md5(bytes);
  return toHex(await crypto.subtle.digest(SUBTLE_NAMES[algorithm], bytes));
}

export type HashOptions = {
  input: string;
  /** One algorithm, or undefined for all of them. */
  algorithm?: HashAlgorithm;
};

export async function generateHashes(options: HashOptions): Promise<ToolResult> {
  if (!options.input) throw new ToolInputError("nothing to hash");

  if (options.algorithm) {
    return { kind: "text", text: await hashOne(options.input, options.algorithm) };
  }

  const fields = [];
  for (const algorithm of HASH_ALGORITHMS) {
    fields.push({ label: LABELS[algorithm], value: await hashOne(options.input, algorithm) });
  }

  return { kind: "fields", fields };
}
