import { clientIp } from "./client-ip";
import { ToolInputError, type ToolResult } from "@/lib/tools/result";

import { formatJson } from "@/lib/tools/impl/json-format";
import { generatePassword, PASSWORD_DEFAULTS } from "@/lib/tools/impl/password";
import { generateToken, type TokenEncoding } from "@/lib/tools/impl/token";
import { generateUuid } from "@/lib/tools/impl/uuid";
import { calculateSubnet } from "@/lib/tools/impl/subnet";
import { DEFAULT_LIMIT, splitSubnet } from "@/lib/tools/impl/subnet-split";
import { convertTimestamp } from "@/lib/tools/impl/timestamp";
import { transformText, type TextOperation } from "@/lib/tools/impl/text";
import { generateSshKeypair, type SshKeyType } from "@/lib/tools/impl/server/ssh";
import { readCertificate } from "@/lib/tools/impl/server/cert";

export type HandlerContext = {
  request: Request;
  /** Query string parameters. */
  params: URLSearchParams;
  /** Raw request body for POST, or null for GET. */
  body: string | null;
};

/**
 * Handlers return the structured ToolResult, not rendered text — the route
 * decides whether that becomes plain text, JSON or XML. Flattening here would
 * throw away the field labels that the machine formats need.
 */
export type ToolHandler = (ctx: HandlerContext) => ToolResult | Promise<ToolResult>;

/** Throw from a handler to return a 400 with a plain-text reason. */
export class BadRequestError extends Error {}

// ---------------------------------------------------------------- parsing

function intParam(params: URLSearchParams, name: string, fallback: number): number {
  const raw = params.get(name);
  if (raw === null || raw === "") return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) {
    throw new BadRequestError(`${name} must be a whole number, got "${raw}"`);
  }
  return value;
}

/**
 * Absent means "leave the default alone"; present means the caller said
 * something. `?symbols=false` and `?symbols=0` both switch a default-on flag
 * off, and a bare `?symbols` reads as on.
 */
function boolParam(params: URLSearchParams, name: string, fallback: boolean): boolean {
  const raw = params.get(name);
  if (raw === null) return fallback;
  if (raw === "") return true;
  return !["false", "0", "no", "off"].includes(raw.toLowerCase());
}

function enumParam<T extends string>(
  params: URLSearchParams,
  name: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = params.get(name);
  if (raw === null || raw === "") return fallback;
  if (!allowed.includes(raw as T)) {
    throw new BadRequestError(`${name} must be one of ${allowed.join(", ")}, got "${raw}"`);
  }
  return raw as T;
}

/** Tools that operate on a document want it POSTed, not squeezed into a query. */
function requireBody(ctx: HandlerContext, hint: string): string {
  const fromQuery = ctx.params.get("input");
  const value = ctx.body?.trim() || fromQuery?.trim();
  if (!value) {
    throw new BadRequestError(
      `this endpoint needs a request body. ${hint}`,
    );
  }
  return value;
}

/** Runs a tool, converting its input errors into 400s. */
function run(compute: () => ToolResult): ToolResult {
  try {
    return compute();
  } catch (error) {
    if (error instanceof ToolInputError) throw new BadRequestError(error.message);
    throw error;
  }
}

// --------------------------------------------------------------- handlers

/**
 * Implemented tools, keyed by the id in lib/tools/registry.ts.
 *
 * Each one calls exactly the same function the browser panel calls, so the two
 * surfaces cannot drift. Anything in the registry without an entry here is
 * served as a 501 by app/api/v1/[tool]/route.ts.
 */
export const HANDLERS: Record<string, ToolHandler> = {
  // `text` rather than `lines`, so JSON yields "1.2.3.4" and not ["1.2.3.4"],
  // while the plain-text rendering stays byte-identical to icanhazip.
  ip: ({ request }) => ({ kind: "text", text: clientIp(request.headers) }),

  "password-generator": ({ params }) =>
    run(() =>
      generatePassword({
        length: intParam(params, "length", PASSWORD_DEFAULTS.length),
        count: intParam(params, "count", 1),
        lowercase: boolParam(params, "lowercase", true),
        uppercase: boolParam(params, "uppercase", true),
        digits: boolParam(params, "digits", true),
        symbols: boolParam(params, "symbols", true),
        excludeAmbiguous: boolParam(params, "exclude-ambiguous", false),
      }),
    ),

  "uuid-generator": ({ params }) =>
    run(() =>
      generateUuid({
        version: intParam(params, "version", 4) === 7 ? 7 : 4,
        count: intParam(params, "count", 1),
        uppercase: boolParam(params, "uppercase", false),
        hyphens: boolParam(params, "hyphens", true),
      }),
    ),

  "token-generator": ({ params }) =>
    run(() =>
      generateToken({
        bytes: intParam(params, "bytes", 32),
        encoding: enumParam<TokenEncoding>(
          params,
          "encoding",
          ["base64url", "hex", "base58"],
          "base64url",
        ),
        prefix: params.get("prefix") ?? "",
        count: intParam(params, "count", 1),
      }),
    ),

  "ssh-keypair-generator": ({ params }) =>
    run(() =>
      generateSshKeypair({
        type: enumParam<SshKeyType>(params, "type", ["ed25519", "rsa"], "ed25519"),
        bits: intParam(params, "bits", 4096) as 2048 | 3072 | 4096,
        comment: params.get("comment") ?? "",
      }),
    ),

  "cert-reader": (ctx) =>
    run(() =>
      readCertificate({
        pem: requireBody(ctx, "Try: curl --data-binary @cert.pem <url>"),
      }),
    ),

  "subnet-calculator": ({ params }) =>
    run(() => {
      const cidr = params.get("cidr") ?? params.get("q");
      if (!cidr) throw new BadRequestError("cidr is required, e.g. ?cidr=10.0.0.0/22");
      return calculateSubnet(cidr);
    }),

  "subnet-splitter": ({ params }) =>
    run(() => {
      const cidr = params.get("cidr");
      if (!cidr) throw new BadRequestError("cidr is required, e.g. ?cidr=10.0.0.0/16");

      // Absent stays absent: splitSubnet treats "none given" as a request for
      // the summary, and "more than one given" as an error, so defaulting any
      // of these would quietly change what was asked for.
      const optionalInt = (name: string) =>
        params.get(name) === null ? undefined : intParam(params, name, 0);

      return splitSubnet({
        cidr,
        count: optionalInt("count"),
        prefix: optionalInt("prefix"),
        divide: params.get("divide") ?? undefined,
        limit: intParam(params, "limit", DEFAULT_LIMIT),
        offset: intParam(params, "offset", 0),
      });
    }),

  "timestamp-converter": ({ params }) =>
    run(() =>
      convertTimestamp({
        value: params.get("value") ?? "now",
        timezone: params.get("tz") ?? "UTC",
      }),
    ),

  "json-beautify": (ctx) =>
    run(() =>
      formatJson({
        input: requireBody(ctx, "Try: curl --data-binary @data.json <url>"),
        indent: intParam(ctx.params, "indent", 2),
        sort: boolParam(ctx.params, "sort", false),
      }),
    ),

  "text-tool": (ctx) =>
    run(() =>
      transformText({
        input: requireBody(ctx, "Try: curl --data-binary @hosts.txt '<url>?op=join'"),
        operation: enumParam<TextOperation>(
          ctx.params,
          "op",
          ["join", "split", "trim", "dedupe", "sort", "reverse", "count"],
          "join",
        ),
        separator: ctx.params.get("sep") ?? ",",
        dropEmpty: boolParam(ctx.params, "drop-empty", true),
      }),
    ),
};
