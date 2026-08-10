/**
 * Randomness helpers shared by the generator tools.
 *
 * Uses the WebCrypto global, which exists in both the browser and Node 24, so
 * these run unchanged on the client and in a route handler.
 */

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * A uniformly distributed integer in [0, max).
 *
 * Rejection sampling, not `% max`. The modulo shortcut biases towards low
 * values whenever max does not divide 256 evenly — which for a 70-character
 * password alphabet means some characters are ~1.4x likelier than others.
 */
export function randomInt(max: number): number {
  if (max <= 0) throw new Error("max must be positive");
  if (max > 256) throw new Error("randomInt only handles alphabets up to 256");

  // Largest multiple of max that fits in a byte; anything above it is rejected.
  const limit = Math.floor(256 / max) * max;
  const buffer = new Uint8Array(1);

  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % max;
  }
}

/** Picks `count` characters from `alphabet`, uniformly and independently. */
export function randomString(alphabet: string, count: number): string {
  let out = "";
  for (let i = 0; i < count; i += 1) {
    out += alphabet[randomInt(alphabet.length)];
  }
  return out;
}

/** Fisher-Yates, so shuffling is not itself a source of bias. */
export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function toBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";

  // Straight base conversion over a bignum built from the bytes.
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);

  let out = "";
  while (value > 0n) {
    out = BASE58_ALPHABET[Number(value % 58n)] + out;
    value /= 58n;
  }

  // Leading zero bytes carry no magnitude, so they have to be re-added.
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = BASE58_ALPHABET[0] + out;
  }

  return out;
}
