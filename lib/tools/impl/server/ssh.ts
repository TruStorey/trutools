import { generateKeyPairSync, randomBytes, createHash } from "node:crypto";

import { ToolInputError, type ToolResult } from "../../result";

/**
 * OpenSSH keypair generation.
 *
 * Node can generate the key material but only exports PKCS#8 / SPKI DER. The
 * OpenSSH formats — the `ssh-ed25519 AAAA...` public line and the
 * `-----BEGIN OPENSSH PRIVATE KEY-----` container — are their own encoding, so
 * the wire framing below is written by hand against PROTOCOL.key and RFC 4253.
 *
 * Server-only: uses node:crypto and must never be bundled for the browser.
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

/** SSH wire "string": a uint32 big-endian length followed by the bytes. */
function sshString(data: Buffer | string): Buffer {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length, 0);
  return Buffer.concat([length, bytes]);
}

function sshUint32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value, 0);
  return buffer;
}

/**
 * SSH wire "mpint": a signed big-endian integer. Leading zero bytes are
 * stripped, but a zero byte is prepended when the top bit is set, otherwise the
 * value would be read as negative.
 */
function sshMpint(raw: Buffer): Buffer {
  let start = 0;
  while (start < raw.length - 1 && raw[start] === 0) start += 1;
  let value = raw.subarray(start);
  if (value.length > 0 && value[0] & 0x80) {
    value = Buffer.concat([Buffer.from([0]), value]);
  }
  return sshString(value);
}

function base64Lines(data: Buffer, width = 70): string {
  const encoded = data.toString("base64");
  const lines: string[] = [];
  for (let i = 0; i < encoded.length; i += width) {
    lines.push(encoded.slice(i, i + width));
  }
  return lines.join("\n");
}

/**
 * Wraps a public key blob in the OpenSSH private key container.
 * The private section is stored unencrypted (ciphername "none"), so the
 * checkint pair is just a consistency marker rather than a password check.
 */
function opensshPrivateKey(publicBlob: Buffer, privateBlob: Buffer, comment: string): Buffer {
  const checkint = randomBytes(4);

  let unencrypted = Buffer.concat([
    checkint,
    checkint,
    privateBlob,
    sshString(comment),
  ]);

  // Pad to a multiple of the cipher block size (8 for "none") with 1,2,3...
  const blockSize = 8;
  const padding: number[] = [];
  let index = 1;
  while ((unencrypted.length + padding.length) % blockSize !== 0) {
    padding.push(index);
    index += 1;
  }
  unencrypted = Buffer.concat([unencrypted, Buffer.from(padding)]);

  return Buffer.concat([
    Buffer.from("openssh-key-v1\0", "binary"),
    sshString("none"), // ciphername
    sshString("none"), // kdfname
    sshString(""), // kdfoptions
    sshUint32(1), // number of keys
    sshString(publicBlob),
    sshString(unencrypted),
  ]);
}

function pemWrap(body: Buffer): string {
  return [
    "-----BEGIN OPENSSH PRIVATE KEY-----",
    base64Lines(body),
    "-----END OPENSSH PRIVATE KEY-----",
    "",
  ].join("\n");
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function buildEd25519() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  // Ed25519 SPKI DER is a fixed 44-byte structure ending in the 32-byte key,
  // and PKCS#8 ends in the 32-byte seed. Slicing beats writing a DER parser.
  const spki = publicKey.export({ format: "der", type: "spki" });
  const pkcs8 = privateKey.export({ format: "der", type: "pkcs8" });
  const rawPublic = spki.subarray(spki.length - 32);
  const seed = pkcs8.subarray(pkcs8.length - 32);

  const publicBlob = Buffer.concat([sshString("ssh-ed25519"), sshString(rawPublic)]);

  // OpenSSH stores the 64-byte "private key" as seed || public key.
  const privateBlob = Buffer.concat([
    sshString("ssh-ed25519"),
    sshString(rawPublic),
    sshString(Buffer.concat([seed, rawPublic])),
  ]);

  return { publicBlob, privateBlob, algorithm: "ssh-ed25519" };
}

function buildRsa(bits: number) {
  // The private JWK carries n and e as well, so the public key object is not
  // needed separately.
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: bits });

  // JWK exposes the CRT components directly; the alternative is parsing PKCS#1.
  const jwk = privateKey.export({ format: "jwk" }) as {
    n: string;
    e: string;
    d: string;
    p: string;
    q: string;
    qi: string;
  };

  const n = fromBase64Url(jwk.n);
  const e = fromBase64Url(jwk.e);

  const publicBlob = Buffer.concat([sshString("ssh-rsa"), sshMpint(e), sshMpint(n)]);

  // OpenSSH's RSA private order is n, e, d, iqmp, p, q — note iqmp comes
  // before the primes, which is not the order any other format uses.
  const privateBlob = Buffer.concat([
    sshString("ssh-rsa"),
    sshMpint(n),
    sshMpint(e),
    sshMpint(fromBase64Url(jwk.d)),
    sshMpint(fromBase64Url(jwk.qi)),
    sshMpint(fromBase64Url(jwk.p)),
    sshMpint(fromBase64Url(jwk.q)),
  ]);

  return { publicBlob, privateBlob, algorithm: "ssh-rsa" };
}

export function generateSshKeypair(options: SshOptions): ToolResult {
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
  const { publicBlob, privateBlob, algorithm } =
    options.type === "ed25519" ? buildEd25519() : buildRsa(options.bits);

  const publicLine =
    `${algorithm} ${publicBlob.toString("base64")}${comment ? ` ${comment}` : ""}`;

  // The SHA256 fingerprint ssh-keygen -lf prints, and what a host key prompt
  // shows you — base64 with the padding stripped.
  const fingerprint = createHash("sha256").update(publicBlob).digest("base64").replace(/=+$/, "");

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
