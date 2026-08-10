import { X509Certificate } from "node:crypto";

import { ToolInputError, type ToolResult } from "../../result";

/**
 * X.509 certificate reader.
 *
 * Server-only: node:crypto has a real X.509 parser, and shipping one to the
 * browser to do the same job would be a waste.
 */

export type CertOptions = {
  pem: string;
};

export const CERT_DEFAULTS: CertOptions = { pem: "" };

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** "CN=example.com\nO=Example Ltd" → "CN=example.com, O=Example Ltd" */
function flattenName(name: string): string {
  return name.split("\n").map((part) => part.trim()).filter(Boolean).join(", ");
}

function describeKey(certificate: X509Certificate): string {
  const key = certificate.publicKey;
  const details = key.asymmetricKeyDetails;

  if (key.asymmetricKeyType === "rsa" && details?.modulusLength) {
    return `RSA ${details.modulusLength} bits`;
  }
  if (key.asymmetricKeyType === "ec" && details?.namedCurve) {
    return `EC ${details.namedCurve}`;
  }
  return key.asymmetricKeyType ?? "unknown";
}

export function readCertificate(options: CertOptions): ToolResult {
  const pem = options.pem.trim();
  if (!pem) throw new ToolInputError("a PEM certificate is required");

  if (!pem.includes("BEGIN CERTIFICATE")) {
    throw new ToolInputError(
      "expected a PEM certificate beginning with -----BEGIN CERTIFICATE-----",
    );
  }

  let certificate: X509Certificate;
  try {
    certificate = new X509Certificate(pem);
  } catch (error) {
    throw new ToolInputError(
      error instanceof Error ? error.message : "could not parse the certificate",
    );
  }

  const validFrom = new Date(certificate.validFrom);
  const validTo = new Date(certificate.validTo);
  const now = new Date();

  // The single thing most people open a cert to find out.
  const remaining = daysBetween(now, validTo);
  const status =
    now < validFrom
      ? `Not yet valid (starts in ${daysBetween(now, validFrom)} days)`
      : remaining < 0
        ? `EXPIRED ${Math.abs(remaining)} days ago`
        : `Valid — expires in ${remaining} days`;

  const fields = [
    { label: "Subject", value: flattenName(certificate.subject) },
    { label: "Issuer", value: flattenName(certificate.issuer) },
    { label: "Status", value: status },
    { label: "Valid from", value: validFrom.toISOString() },
    { label: "Valid to", value: validTo.toISOString() },
    { label: "Serial", value: certificate.serialNumber },
    { label: "Public key", value: describeKey(certificate) },
    { label: "Is CA", value: certificate.ca ? "yes" : "no" },
    { label: "SHA-1 fingerprint", value: certificate.fingerprint },
    { label: "SHA-256 fingerprint", value: certificate.fingerprint256 },
  ];

  if (certificate.subjectAltName) {
    fields.push({
      label: "Subject alt names",
      value: certificate.subjectAltName.split(",").map((n) => n.trim()).join("\n"),
    });
  }

  if (certificate.keyUsage?.length) {
    fields.push({ label: "Key usage", value: certificate.keyUsage.join(", ") });
  }

  if (certificate.infoAccess) {
    fields.push({ label: "Info access", value: certificate.infoAccess.trim() });
  }

  return { kind: "fields", fields };
}
