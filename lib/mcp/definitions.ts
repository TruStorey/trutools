/**
 * What tools/list advertises, written for a model rather than a person.
 *
 * Every definition is sent on every model request, so these are deliberately
 * shorter than the registry's text, which stays as it is for the site and the
 * API reference. Validation does not live here: lib/mcp/server.ts checks calls
 * with Zod and the handlers do the rest, and their errors state the ranges and
 * formats left out below. Only say here what a model could not otherwise find
 * out: what a tool does, which values exist, and defaults worth knowing.
 *
 * Parameter names and `required` come from the registry, so neither can drift.
 * An `enum` must list only values the handler accepts, because a client may
 * enforce it.
 */
import { CASE_STYLES } from "@/lib/tools/impl/case-convert";
import { HASH_ALGORITHMS } from "@/lib/tools/impl/hash";
import { LOREM_UNITS } from "@/lib/tools/impl/lorem";
import { DNS_TYPES } from "@/lib/tools/impl/server/dns";
import type { Tool } from "@/lib/tools/registry";

export type ParamSpec = {
  type: "string" | "integer" | "number" | "boolean";
  enum?: readonly (string | number)[];
  description?: string;
};

type Definition = {
  description: string;
  params: Record<string, ParamSpec>;
};

const string: ParamSpec = { type: "string" };
const integer: ParamSpec = { type: "integer" };
const number: ParamSpec = { type: "number" };
const boolean: ParamSpec = { type: "boolean" };

const oneOf = (values: readonly string[]): ParamSpec => ({ type: "string", enum: values });
const timezone: ParamSpec = { type: "string", description: "IANA name" };

/** Keyed by registry id. A new tool still works without an entry, just at full size. */
export const DEFINITIONS: Record<string, Definition> = {
  "password-generator": {
    description: "Random passwords. Default 24 chars with all character classes.",
    params: {
      length: integer,
      count: integer,
      lowercase: boolean,
      uppercase: boolean,
      digits: boolean,
      symbols: boolean,
      "exclude-ambiguous": boolean,
    },
  },
  "uuid-generator": {
    description: "Hyphenated lowercase UUIDs. Default v4; v7 sorts by time.",
    params: {
      version: { type: "integer", enum: [4, 7] },
      count: integer,
      uppercase: boolean,
      hyphens: boolean,
    },
  },
  "token-generator": {
    description: "Random tokens. Default 32 bytes, base64url.",
    params: {
      bytes: integer,
      encoding: oneOf(["base64url", "hex", "base58"]),
      prefix: { type: "string", description: "Joined with _" },
      count: integer,
    },
  },
  "hash-generator": {
    description: "All four digests of text unless algo is set. MD5 and SHA-1 are for checksums only.",
    params: { body: string, algo: oneOf(HASH_ALGORITHMS) },
  },
  "jwt-decoder": {
    description: "Decode a JWT's header, payload and expiry without verifying it.",
    params: { token: string },
  },
  "ssh-key-inspect": {
    description: "Type, size, fingerprints, comment and options of an SSH public key line.",
    params: { body: string },
  },
  "ssh-keypair-generator": {
    description: "OpenSSH keypair. Default ed25519; RSA defaults to 4096 bits.",
    params: {
      type: oneOf(["ed25519", "rsa"]),
      bits: { type: "integer", enum: [2048, 3072, 4096] },
      comment: string,
    },
  },
  "cert-reader": {
    description: "Subject, issuer, SANs, validity and fingerprints of a PEM certificate.",
    params: { body: string },
  },
  "subnet-inspector": {
    description: "Network, broadcast, usable range, mask and host count of an IPv4 or IPv6 CIDR.",
    params: { cidr: string },
  },
  "subnet-splitter": {
    description: "Split a CIDR into equal subnets by count or prefix, paged 256 rows at a time.",
    params: {
      cidr: string,
      count: { type: "integer", description: "Rounded up to a power of two" },
      prefix: { type: "integer", description: "Target prefix length" },
      limit: integer,
      offset: integer,
    },
  },
  "subnet-planner": {
    description: "Fit named subnets into a CIDR by size and show what is left over.",
    params: {
      cidr: string,
      need: { type: "string", description: "name:size list; size is hosts or /prefix: pods:4000,dmz:/26" },
    },
  },
  "dns-lookup": {
    description: "DNS records with TTLs and DNSSEC status. Default type A; all gives the common set.",
    params: { name: string, type: oneOf([...DNS_TYPES, "all"]) },
  },
  "mail-check": {
    description: "SPF and DMARC for a domain, flagging SPF over the ten-lookup limit.",
    params: { domain: string },
  },
  bandwidth: {
    description: "Convert a link rate and work out a transfer time. Defaults: Gbps, GiB.",
    params: {
      rate: number,
      unit: { type: "string", description: "e.g. Mbps, MB/s" },
      size: number,
      sizeUnit: { type: "string", description: "e.g. GB, TiB" },
      overhead: { type: "number", description: "Percent; 6 is typical for TCP" },
    },
  },
  base64: {
    description: "Base64 encode or decode text. Default mode auto guesses which.",
    params: { body: string, mode: oneOf(["auto", "encode", "decode"]), urlsafe: boolean },
  },
  "bytes-converter": {
    description: "Convert a size to 1000- and 1024-based units, or just the to unit.",
    params: { value: number, from: { type: "string", description: "e.g. GB, GiB" }, to: string },
  },
  "yaml-json": {
    description: "Convert YAML to JSON or back. Default to auto picks the other format.",
    params: { body: string, to: oneOf(["auto", "json", "yaml"]), indent: integer },
  },
  duration: {
    description: "Convert seconds, 1h30m, systemd spans or ISO 8601 durations between forms.",
    params: { value: string },
  },
  "timestamp-converter": {
    description: 'Convert epoch seconds or millis, ISO 8601 or "now" to date forms. Default now, UTC.',
    params: { value: string, tz: timezone },
  },
  "json-beautify": {
    description: "Pretty-print JSON, or minify with indent 0. Default indent 2.",
    params: { body: string, indent: integer, sort: boolean },
  },
  "case-converter": {
    description: "Convert text to one case style, or all of them if to is omitted.",
    params: { text: string, to: oneOf(CASE_STYLES) },
  },
  "lorem-ipsum": {
    description: "Lorem ipsum filler. Default 3 paragraphs with the classic opening.",
    params: { unit: oneOf(LOREM_UNITS), count: integer, classic: boolean },
  },
  "text-tool": {
    description: "Process lines. Default op joins with commas; blank lines are dropped.",
    params: {
      body: string,
      op: oneOf(["join", "split", "trim", "dedupe", "sort", "reverse", "count"]),
      sep: { type: "string", description: "Supports \\n, \\t" },
      "drop-empty": boolean,
    },
  },
  "disk-space": {
    description: "Any two of capacity, used (sizes like 100TB) and percent give the third, plus free.",
    params: { capacity: string, used: string, percent: string },
  },
  "file-permissions": {
    description: "Convert a file mode between octal (755) and symbolic (rwxr-xr-x).",
    params: { mode: string, symbolic: string },
  },
  "systemd-lint": {
    description: "Lint a systemd unit file for structural mistakes.",
    params: { body: string },
  },
  "cron-explain": {
    description: "Explain a 5-field cron expression or @macro and list its next runs. Default 5, UTC.",
    params: { expr: string, count: integer, tz: timezone },
  },
};

/** The description and JSON Schema a tool is advertised with. */
export function mcpDefinition(tool: Tool) {
  const definition = DEFINITIONS[tool.id];

  const properties = Object.fromEntries(
    tool.api.params.map((param): [string, ParamSpec] => [
      param.name,
      definition?.params[param.name] ?? { type: "string", description: param.description },
    ]),
  );
  const required = tool.api.params.filter((param) => param.required).map((param) => param.name);

  return {
    description: definition?.description ?? tool.description,
    inputSchema: {
      type: "object" as const,
      properties,
      ...(required.length > 0 ? { required } : {}),
    },
  };
}
