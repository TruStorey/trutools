import { ToolInputError, type ToolResult } from "../result";
import { md5 } from "./md5";

/**
 * Reads an OpenSSH public key or an authorized_keys line.
 *
 * The inverse of what ssh.ts writes: the base64 blob is a sequence of
 * length-prefixed fields, the first of which repeats the algorithm name. That
 * repetition is worth checking — a line whose prefix says ssh-rsa but whose
 * blob says ssh-ed25519 has been edited by hand, and OpenSSH trusts the blob.
 *
 * Fingerprints are computed both ways because the two tools people compare
 * against disagree: `ssh-keygen -lf` prints SHA256 base64 by default, and
 * `-E md5` prints the older colon-separated hex that still appears in cloud
 * consoles and older docs.
 */

/** authorized_keys options that take no value, so the parser knows not to expect one. */
const FLAG_OPTIONS = new Set([
  "no-agent-forwarding",
  "no-port-forwarding",
  "no-pty",
  "no-user-rc",
  "no-x11-forwarding",
  "restrict",
  "cert-authority",
  "verify-required",
  "port-forwarding",
  "pty",
  "user-rc",
  "x11-forwarding",
  "agent-forwarding",
]);

const KEY_TYPES = new Set([
  "ssh-rsa",
  "ssh-dss",
  "ssh-ed25519",
  "ssh-ed448",
  "sk-ssh-ed25519@openssh.com",
  "ecdsa-sha2-nistp256",
  "ecdsa-sha2-nistp384",
  "ecdsa-sha2-nistp521",
  "sk-ecdsa-sha2-nistp256@openssh.com",
]);

function fromBase64(value: string): Uint8Array {
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    throw new ToolInputError("the key body is not valid base64");
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Walks the length-prefixed fields of an SSH wire blob. */
function readFields(blob: Uint8Array): Uint8Array[] {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const fields: Uint8Array[] = [];
  let offset = 0;

  while (offset + 4 <= blob.length) {
    const length = view.getUint32(offset, false);
    offset += 4;
    if (length > blob.length - offset) {
      throw new ToolInputError("the key body is truncated or not an SSH public key");
    }
    fields.push(blob.subarray(offset, offset + length));
    offset += length;
  }

  if (offset !== blob.length) {
    throw new ToolInputError("the key body has trailing bytes");
  }

  return fields;
}

/**
 * Splits off any leading authorized_keys options.
 *
 * Options are comma separated and values may be quoted, and a quoted value can
 * itself contain spaces and commas — `command="foo bar,baz"` — so this cannot
 * simply split on whitespace.
 */
function splitOptions(line: string): { options: string | null; rest: string } {
  const trimmed = line.trim();
  const firstWord = trimmed.split(/\s+/)[0];

  if (KEY_TYPES.has(firstWord)) return { options: null, rest: trimmed };

  let inQuotes = false;
  for (let i = 0; i < trimmed.length; i += 1) {
    const character = trimmed[i];
    if (character === '"') inQuotes = !inQuotes;
    else if (!inQuotes && /\s/.test(character)) {
      return { options: trimmed.slice(0, i), rest: trimmed.slice(i + 1).trim() };
    }
  }

  throw new ToolInputError("could not find a key type in this line");
}

function describeOptions(options: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const character of options) {
    if (character === '"') inQuotes = !inQuotes;
    if (character === "," && !inQuotes) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  if (current) parts.push(current);

  return parts.map((part) => {
    const name = part.split("=")[0];
    if (FLAG_OPTIONS.has(name)) return part;
    return part;
  });
}

/** RSA and DSA carry their size in an mpint; the rest are fixed by their curve. */
function bitsFor(type: string, fields: Uint8Array[]): number | null {
  if (type === "ssh-rsa") {
    const modulus = fields[2];
    if (!modulus) return null;
    // Strip the sign byte an mpint adds when the top bit is set.
    let start = 0;
    while (start < modulus.length && modulus[start] === 0) start += 1;
    return (modulus.length - start) * 8;
  }
  if (type === "ssh-ed25519") return 256;
  if (type === "ssh-ed448") return 448;
  const curve = /nistp(\d+)/.exec(type);
  if (curve) return Number(curve[1]);
  return null;
}

export async function inspectSshKey(input: string): Promise<ToolResult> {
  const line = input.trim().split(/\r?\n/).find((candidate) => candidate.trim() && !candidate.trim().startsWith("#"));

  if (!line) throw new ToolInputError("a public key is required");

  if (line.includes("PRIVATE KEY")) {
    throw new ToolInputError(
      "that is a private key — paste the public one, and do not paste private keys into websites",
    );
  }

  const { options, rest } = splitOptions(line);
  const [type, body, ...commentParts] = rest.split(/\s+/);

  if (!type || !body) throw new ToolInputError("expected a line like: ssh-ed25519 AAAA... comment");
  if (!KEY_TYPES.has(type)) throw new ToolInputError(`"${type}" is not a known SSH key type`);

  const blob = fromBase64(body);
  const fields = readFields(blob);

  const declared = new TextDecoder().decode(fields[0] ?? new Uint8Array());
  if (declared !== type) {
    throw new ToolInputError(
      `the line says ${type} but the key body says ${declared || "nothing"} — this key has been edited`,
    );
  }

  // Copied first: a Uint8Array from base64 decoding is ArrayBufferLike, which
  // no longer satisfies BufferSource now the typed arrays are generic.
  const sha256 = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(blob)));
  const bits = bitsFor(type, fields);

  const result = [
    { label: "Type", value: type },
    ...(bits ? [{ label: "Bits", value: String(bits) }] : []),
    { label: "SHA256", value: `SHA256:${toBase64(sha256).replace(/=+$/, "")}` },
    { label: "MD5", value: `MD5:${(md5(blob).match(/../g) ?? []).join(":")}` },
    { label: "Comment", value: commentParts.join(" ") || "none" },
    { label: "Length", value: `${body.length} base64 characters, ${blob.length} bytes` },
  ];

  if (options) {
    result.push({ label: "Options", value: describeOptions(options).join("\n") });

    if (/^command=/.test(options) || options.includes(",command=")) {
      result.push({
        label: "Forced command",
        value: "this key can only run the given command, whatever the client asks for",
      });
    }
    if (options.includes("cert-authority")) {
      result.push({
        label: "Certificate authority",
        value: "this is a CA key — anything it signs is trusted, not just this key",
      });
    }
  }

  if (type === "ssh-rsa" && bits && bits < 2048) {
    result.push({ label: "Warning", value: `${bits}-bit RSA is too small; OpenSSH rejects it by default` });
  }
  if (type === "ssh-dss") {
    result.push({ label: "Warning", value: "DSA is disabled in modern OpenSSH and should be replaced" });
  }

  return { kind: "fields", fields: result };
}
