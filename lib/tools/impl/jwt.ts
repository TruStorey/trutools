import { ToolInputError, type ToolResult } from "../result";

/**
 * JWT inspection. Decoding only — nothing here verifies anything.
 *
 * The signature cannot be checked without the key, and a decoder that stays
 * quiet about that invites someone to read a forged token as if it were
 * trustworthy. So the result carries that warning as a field, not just a
 * sentence in the docs.
 */

function decodeSegment(segment: string, what: string): string {
  const normalised = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");

  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ToolInputError(`the ${what} is not valid base64url`);
  }
}

function parseJson(raw: string, what: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("not an object");
    }
    return value as Record<string, unknown>;
  } catch {
    throw new ToolInputError(`the ${what} is not a JSON object`);
  }
}

/** JWT times are seconds since the epoch (RFC 7519 NumericDate), not millis. */
function describeTime(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  const date = new Date(value * 1000);
  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];

  let relative = "now";
  for (const [unit, seconds] of units) {
    if (Math.abs(deltaSeconds) >= seconds) {
      relative = formatter.format(Math.round(deltaSeconds / seconds), unit);
      break;
    }
  }

  return `${date.toISOString()}  (${relative})`;
}

export function inspectJwt(token: string): ToolResult {
  const trimmed = token.trim();
  if (!trimmed) throw new ToolInputError("a token is required");

  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    throw new ToolInputError(
      `a JWT has three dot-separated parts; this has ${parts.length}`,
    );
  }

  const header = parseJson(decodeSegment(parts[0], "header"), "header");
  const payload = parseJson(decodeSegment(parts[1], "payload"), "payload");

  const fields: { label: string; value: string }[] = [
    { label: "Algorithm", value: String(header.alg ?? "not stated") },
    { label: "Type", value: String(header.typ ?? "not stated") },
  ];

  if (header.kid) fields.push({ label: "Key ID", value: String(header.kid) });

  const expires = describeTime(payload.exp);
  const issued = describeTime(payload.iat);
  const notBefore = describeTime(payload.nbf);

  if (typeof payload.exp === "number") {
    const expired = payload.exp * 1000 < Date.now();
    fields.push({ label: "Status", value: expired ? "EXPIRED" : "Not expired" });
  } else {
    fields.push({ label: "Status", value: "No exp claim — this token never expires" });
  }

  if (expires) fields.push({ label: "Expires", value: expires });
  if (issued) fields.push({ label: "Issued", value: issued });
  if (notBefore) fields.push({ label: "Not before", value: notBefore });

  for (const [claim, label] of [
    ["iss", "Issuer"],
    ["sub", "Subject"],
    ["aud", "Audience"],
    ["jti", "JWT ID"],
  ] as const) {
    if (payload[claim] !== undefined) {
      fields.push({ label, value: JSON.stringify(payload[claim]).replace(/^"|"$/g, "") });
    }
  }

  fields.push(
    { label: "Header", value: JSON.stringify(header, null, 2) },
    { label: "Payload", value: JSON.stringify(payload, null, 2) },
    {
      label: "Signature",
      value: `${parts[2].slice(0, 24)}${parts[2].length > 24 ? "…" : ""}  NOT VERIFIED — decoding proves nothing about authenticity`,
    },
  );

  return { kind: "fields", fields };
}
