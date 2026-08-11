import { ToolInputError, type ToolResult } from "../../result";
import { parseIpv4, parseIpv6 } from "../ip";
import { dohQuery, DOH_STATUS, type DohResponse } from "./doh";

/**
 * DNS lookups over Cloudflare's DNS-over-HTTPS JSON API.
 *
 * Server-side even though `fetch` would work in the browser. Querying
 * Cloudflare directly from the page would mean two implementations of the same
 * tool — one parsing the JSON in the panel, another in the handler — and they
 * would drift. Going through our own endpoint keeps a single parser, so the
 * browser and `curl` always give the same answer.
 *
 * There is no SSRF surface here: the host contacted is a constant. Only the
 * query string varies, and the name in it is validated as a hostname first.
 */

export const DNS_TYPES = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "NS",
  "SOA",
  "SRV",
  "CAA",
  "PTR",
] as const;

export type DnsType = (typeof DNS_TYPES)[number];

/** The set a bare `type=all` asks for — the ones worth seeing together. */
const COMMON: DnsType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"];

/** Answers carry the numeric type, so it has to be mapped back for display. */
const TYPE_NAMES: Record<number, string> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  6: "SOA",
  12: "PTR",
  15: "MX",
  16: "TXT",
  28: "AAAA",
  33: "SRV",
  43: "DS",
  46: "RRSIG",
  48: "DNSKEY",
  64: "SVCB",
  65: "HTTPS",
  257: "CAA",
};


/**
 * Accepts what people actually paste — a URL, a trailing dot, mixed case — and
 * reduces it to a hostname, then checks it really is one.
 */
export function normaliseHostname(input: string): string {
  let name = input.trim().toLowerCase();

  // Strip a scheme and anything after the host, so pasting a URL works.
  name = name.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  name = name.split("/")[0].split("?")[0].split("#")[0];
  name = name.replace(/:\d+$/, "");
  name = name.replace(/\.$/, "");

  if (!name) throw new ToolInputError("a hostname is required, e.g. ?name=example.com");
  if (name.length > 253) throw new ToolInputError("hostname is longer than 253 characters");

  const labels = name.split(".");
  for (const label of labels) {
    if (label.length === 0) throw new ToolInputError(`"${input}" has an empty label`);
    if (label.length > 63) throw new ToolInputError(`label "${label}" is longer than 63 characters`);
    if (!/^[a-z0-9_-]+$/.test(label)) {
      throw new ToolInputError(`"${input}" is not a hostname — "${label}" has invalid characters`);
    }
  }

  return name;
}

const query = (name: string, type: DnsType): Promise<DohResponse> => dohQuery(name, type);

/**
 * PTR lookups are really queries for a name under in-addr.arpa or ip6.arpa.
 * People type the address, so convert it rather than returning the NXDOMAIN
 * that "8.8.8.8" as a literal name would produce.
 */
export function toReverseName(address: string): string | null {
  const value = address.trim();

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    try {
      parseIpv4(value);
    } catch {
      return null;
    }
    return `${value.split(".").reverse().join(".")}.in-addr.arpa`;
  }

  if (value.includes(":")) {
    let numeric: bigint;
    try {
      numeric = parseIpv6(value);
    } catch {
      return null;
    }
    // Every nibble, least significant first.
    const nibbles = numeric.toString(16).padStart(32, "0").split("").reverse();
    return `${nibbles.join(".")}.ip6.arpa`;
  }

  return null;
}

export type DnsOptions = {
  name: string;
  /** A single record type, or "all" for the common set. */
  type: DnsType | "all";
};

export async function lookupDns(options: DnsOptions): Promise<ToolResult> {
  const reverse = options.type === "PTR" ? toReverseName(options.name) : null;
  const name = reverse ?? normaliseHostname(options.name);
  const types = options.type === "all" ? COMMON : [options.type];

  const responses = await Promise.all(types.map((type) => query(name, type)));

  const rows: string[][] = [];
  let authenticated = false;
  const statuses = new Set<string>();

  responses.forEach((response, index) => {
    authenticated = authenticated || response.AD === true;
    statuses.add(DOH_STATUS[response.Status] ?? `status ${response.Status}`);

    for (const answer of response.Answer ?? []) {
      rows.push([
        answer.name.replace(/\.$/, ""),
        TYPE_NAMES[answer.type] ?? String(answer.type),
        String(answer.TTL),
        answer.data,
      ]);
    }

    // A single-type query that found nothing should say which type, rather
    // than returning a table that is silently empty.
    if (!response.Answer?.length && types.length === 1) {
      const soa = response.Authority?.find((record) => record.type === 6);
      rows.push([
        name,
        types[index],
        soa ? String(soa.TTL) : "-",
        `no ${types[index]} records`,
      ]);
    }
  });

  const status = [...statuses].join(", ");
  const notes = [`Status ${status}.`];

  if (status.includes("NXDOMAIN")) notes.push("The name does not exist.");
  notes.push(authenticated ? "DNSSEC validated." : "Not DNSSEC validated.");
  if (reverse) notes.push(`Queried as ${reverse}.`);
  notes.push("Resolved by cloudflare-dns.com.");

  return {
    kind: "rows",
    columns: ["Name", "Type", "TTL", "Data"],
    rows: rows.length ? rows : [[name, "-", "-", "no records found"]],
    note: notes.join(" "),
  };
}
