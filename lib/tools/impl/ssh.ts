import { ToolInputError, type ToolResult } from "../result";
import { randomBytes } from "./random";

/**
 * OpenSSH keypair generation, in WebCrypto only.
 *
 * This used to be server-only, using node:crypto's generateKeyPairSync. That
 * was the single most expensive thing the service did: RSA-4096 took ~700ms of
 * *synchronous* CPU, and because it blocked the event loop a handful of
 * concurrent requests made every other endpoint hang for seconds.
 *
 * WebCrypto has everything the OpenSSH formats need — Ed25519 raw/PKCS#8
 * export, and RSA JWK carrying n, e, d, p, q, qi — so the same code now runs in
 * the browser. Three things improve at once: the server does no key work, it is
 * faster (~260ms for RSA-4096 rather than ~700ms), and the private key never
 * crosses the network when generated from the page.
 *
 * The wire framing below is written by hand against PROTOCOL.key and RFC 4253,
 * since neither platform will produce OpenSSH's formats for you.
 */

export type SshKeyType = "ed25519" | "rsa";

export type SshOptions = {
  type: SshKeyType;
  bits: 2048 | 3072 | 4096;
  comment: string;
};

export const SSH_DEFAULTS: SshOptions = {
  type: "ed25519",
  bits: 4096,
  comment: "",
};

// ------------------------------------------------------------ byte plumbing

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function uint32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, false);
  return out;
}

const utf8 = (value: string) => new TextEncoder().encode(value);

/** SSH wire "string": a uint32 big-endian length followed by the bytes. */
function sshString(data: Uint8Array | string): Uint8Array {
  const bytes = typeof data === "string" ? utf8(data) : data;
  return concat(uint32(bytes.length), bytes);
}

/**
 * SSH wire "mpint": a signed big-endian integer. Leading zero bytes are
 * stripped, but a zero byte is prepended when the top bit is set, otherwise the
 * value would be read as negative.
 */
function sshMpint(raw: Uint8Array): Uint8Array {
  let start = 0;
  while (start < raw.length - 1 && raw[start] === 0) start += 1;

  let value = raw.subarray(start);
  if (value.length > 0 && value[0] & 0x80) {
    value = concat(new Uint8Array([0]), value);
  }
  return sshString(value);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64Url(value: string): Uint8Array {
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function base64Lines(data: Uint8Array, width = 70): string {
  const encoded = toBase64(data);
  const lines: string[] = [];
  for (let i = 0; i < encoded.length; i += width) lines.push(encoded.slice(i, i + width));
  return lines.join("\n");
}

// ------------------------------------------------------------- key material

/**
 * Wraps a public key blob in the OpenSSH private key container.
 * The private section is stored unencrypted (ciphername "none"), so the
 * checkint pair is just a consistency marker rather than a password check.
 */
function opensshPrivateKey(
  publicBlob: Uint8Array,
  privateBlob: Uint8Array,
  comment: string,
): Uint8Array {
  const checkint = randomBytes(4);

  let unencrypted = concat(checkint, checkint, privateBlob, sshString(comment));

  // Pad to a multiple of the cipher block size (8 for "none") with 1,2,3...
  const padding: number[] = [];
  let index = 1;
  while ((unencrypted.length + padding.length) % 8 !== 0) {
    padding.push(index);
    index += 1;
  }
  unencrypted = concat(unencrypted, new Uint8Array(padding));

  return concat(
    utf8("openssh-key-v1\0"),
    sshString("none"), // ciphername
    sshString("none"), // kdfname
    sshString(""), // kdfoptions
    uint32(1), // number of keys
    sshString(publicBlob),
    sshString(unencrypted),
  );
}

function pemWrap(body: Uint8Array): string {
  return [
    "-----BEGIN OPENSSH PRIVATE KEY-----",
    base64Lines(body),
    "-----END OPENSSH PRIVATE KEY-----",
    "",
  ].join("\n");
}

async function buildEd25519() {
  const pair = (await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;

  const rawPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));

  // Ed25519 PKCS#8 is a fixed 48-byte structure ending in the 32-byte seed.
  const seed = pkcs8.subarray(pkcs8.length - 32);

  const publicBlob = concat(sshString("ssh-ed25519"), sshString(rawPublic));

  // OpenSSH stores the 64-byte "private key" as seed || public key.
  const privateBlob = concat(
    sshString("ssh-ed25519"),
    sshString(rawPublic),
    sshString(concat(seed, rawPublic)),
  );

  return { publicBlob, privateBlob, algorithm: "ssh-ed25519" };
}

async function buildRsa(bits: number) {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: bits,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  // JWK carries the CRT components directly; the alternative is parsing PKCS#1.
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as {
    n: string;
    e: string;
    d: string;
    p: string;
    q: string;
    qi: string;
  };

  const n = fromBase64Url(jwk.n);
  const e = fromBase64Url(jwk.e);

  const publicBlob = concat(sshString("ssh-rsa"), sshMpint(e), sshMpint(n));

  // OpenSSH's RSA private order is n, e, d, iqmp, p, q — note iqmp comes
  // before the primes, which is not the order any other format uses.
  const privateBlob = concat(
    sshString("ssh-rsa"),
    sshMpint(n),
    sshMpint(e),
    sshMpint(fromBase64Url(jwk.d)),
    sshMpint(fromBase64Url(jwk.qi)),
    sshMpint(fromBase64Url(jwk.p)),
    sshMpint(fromBase64Url(jwk.q)),
  );

  return { publicBlob, privateBlob, algorithm: "ssh-rsa" };
}

/**
 * Whether this runtime can generate the given key type locally.
 *
 * Ed25519 arrived in WebCrypto late (Chrome 137, Safari 17), so a browser that
 * cannot do it falls back to the API rather than failing. RSA has been there
 * since the beginning. The probe costs about 4ms.
 */
export async function localKeygenSupported(type: SshKeyType): Promise<boolean> {
  if (type !== "ed25519") return true;
  try {
    await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
    return true;
  } catch {
    return false;
  }
}

export async function generateSshKeypair(options: SshOptions): Promise<ToolResult> {
  if (options.type !== "ed25519" && options.type !== "rsa") {
    throw new ToolInputError('type must be "ed25519" or "rsa"');
  }
  if (options.type === "rsa" && ![2048, 3072, 4096].includes(options.bits)) {
    throw new ToolInputError("bits must be 2048, 3072 or 4096");
  }
  if (options.comment.length > 200) {
    throw new ToolInputError("comment must be 200 characters or fewer");
  }

  const comment = options.comment.trim();

  let built: { publicBlob: Uint8Array; privateBlob: Uint8Array; algorithm: string };
  try {
    built = options.type === "ed25519" ? await buildEd25519() : await buildRsa(options.bits);
  } catch (error) {
    throw new ToolInputError(
      error instanceof Error && error.name === "NotSupportedError"
        ? `${options.type} keys are not supported by this browser's WebCrypto`
        : "key generation failed",
    );
  }

  const { publicBlob, privateBlob, algorithm } = built;

  const publicLine = `${algorithm} ${toBase64(publicBlob)}${comment ? ` ${comment}` : ""}`;

  // The SHA256 fingerprint ssh-keygen -lf prints, and what a host key prompt
  // shows you — base64 with the padding stripped.
  // Copied into a fresh array first: concat/subarray produce
  // Uint8Array<ArrayBufferLike>, which does not satisfy BufferSource since
  // TypeScript made the typed arrays generic over their buffer.
  const digestInput = new Uint8Array(publicBlob);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", digestInput));
  const fingerprint = toBase64(digest).replace(/=+$/, "");

  return {
    kind: "fields",
    fields: [
      { label: "Type", value: algorithm },
      ...(options.type === "rsa" ? [{ label: "Bits", value: String(options.bits) }] : []),
      { label: "Fingerprint", value: `SHA256:${fingerprint}` },
      { label: "Public key", value: publicLine },
      { label: "Private key", value: pemWrap(opensshPrivateKey(publicBlob, privateBlob, comment)) },
    ],
  };
}
