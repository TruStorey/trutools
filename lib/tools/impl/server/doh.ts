import { ToolInputError } from "../../result";

/**
 * The DNS-over-HTTPS transport, shared by the DNS lookup and mail checks.
 *
 * The host is a constant, so there is no SSRF surface: only the query string
 * varies, and callers validate the name before it gets here.
 */

const RESOLVER = "https://cloudflare-dns.com/dns-query";
const REQUEST_TIMEOUT_MS = 5_000;

export type DohAnswer = { name: string; type: number; TTL: number; data: string };

export type DohResponse = {
  Status: number;
  AD?: boolean;
  Answer?: DohAnswer[];
  Authority?: DohAnswer[];
  Comment?: string;
};

export const DOH_STATUS: Record<number, string> = {
  0: "NOERROR",
  1: "FORMERR",
  2: "SERVFAIL",
  3: "NXDOMAIN",
  4: "NOTIMP",
  5: "REFUSED",
};

export async function dohQuery(name: string, type: string): Promise<DohResponse> {
  const url = `${RESOLVER}?name=${encodeURIComponent(name)}&type=${type}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { accept: "application/dns-json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) throw new ToolInputError(`the resolver answered ${response.status}`);
    return (await response.json()) as DohResponse;
  } catch (error) {
    if (error instanceof ToolInputError) throw error;
    // An abort, a failure reaching Cloudflare, a TLS problem — from the
    // caller's side these are all "the lookup did not happen".
    throw new ToolInputError(
      error instanceof Error && error.name === "AbortError"
        ? `the resolver did not answer within ${REQUEST_TIMEOUT_MS / 1000}s`
        : "could not reach the resolver",
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * TXT records arrive as quoted strings, and anything over 255 characters is
 * split into several that must be concatenated with nothing between them —
 * which is how long DKIM keys and SPF records are carried.
 */
export async function txtRecords(name: string): Promise<string[]> {
  const response = await dohQuery(name, "TXT");
  return (response.Answer ?? [])
    .filter((answer) => answer.type === 16)
    .map((answer) => answer.data.replace(/^"|"$/g, "").replace(/"\s+"/g, ""));
}

export const RESOLVER_NAME = "cloudflare-dns.com";
