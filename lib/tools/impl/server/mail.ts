import { ToolInputError, type ToolResult } from "../../result";
import { txtRecords } from "./doh";
import { normaliseHostname } from "./dns";

/**
 * SPF and DMARC checks for a domain.
 *
 * The headline check is SPF's DNS-lookup budget. RFC 7208 §4.6.4 allows a
 * receiver ten DNS-querying mechanisms while evaluating a record, and requires
 * it to return permerror beyond that — at which point the mail is treated as
 * unauthenticated.
 *
 * That limit is enforced by the *receiving* mail server, not by DNS and not by
 * the domain owner, so nothing tells you when you cross it. It creeps up as
 * services are added, one `include:` at a time, and delivery quietly degrades.
 *
 * This walks the record the way a receiver would and counts, deliberately
 * continuing past ten so the report can say how far over you are rather than
 * merely that you are.
 */

/** Mechanisms and modifiers that cost a receiver a DNS lookup. */
const COSTS_A_LOOKUP = new Set(["include", "a", "mx", "ptr", "exists", "redirect"]);

export const SPF_LOOKUP_LIMIT = 10;

/**
 * The verdict on a lookup count, split out so the over-budget branch can be
 * tested — no real domain we could find is over, precisely because operators
 * trim to fit, so live data never exercises it.
 */
export function describeSpfBudget(lookups: number): { result: string; detail: string } {
  if (lookups > SPF_LOOKUP_LIMIT) {
    return {
      result: `${lookups} of ${SPF_LOOKUP_LIMIT}`,
      detail: "OVER — receivers return permerror and treat the mail as unauthenticated",
    };
  }
  if (lookups === SPF_LOOKUP_LIMIT) {
    return {
      result: `${lookups} of ${SPF_LOOKUP_LIMIT}`,
      detail: "at the limit — adding one more service breaks SPF",
    };
  }
  return {
    result: `${lookups} of ${SPF_LOOKUP_LIMIT}`,
    detail: `${SPF_LOOKUP_LIMIT - lookups} to spare`,
  };
}

/** A hostile or broken record must not be able to make us query forever. */
const MAX_QUERIES = 40;
const MAX_DEPTH = 10;

type SpfWalk = {
  record: string | null;
  recordCount: number;
  lookups: number;
  /** Per top-level term, what it cost including everything it pulled in. */
  breakdown: { term: string; cost: number }[];
  allQualifier: string | null;
  problems: string[];
  queries: number;
  truncated: boolean;
};

function findSpf(records: string[]): string[] {
  return records.filter((record) => /^v=spf1(\s|$)/i.test(record.trim()));
}

/**
 * Counts the DNS-querying mechanisms a receiver would spend on this record,
 * following include: and redirect= exactly as one would.
 */
async function walkSpf(
  domain: string,
  state: { queries: number; seen: Set<string> },
  depth: number,
): Promise<{ lookups: number; problems: string[] }> {
  if (depth > MAX_DEPTH || state.queries >= MAX_QUERIES) return { lookups: 0, problems: [] };
  if (state.seen.has(domain)) {
    return { lookups: 0, problems: [`include loop back to ${domain}`] };
  }
  state.seen.add(domain);

  state.queries += 1;
  const records = findSpf(await txtRecords(domain));
  if (records.length === 0) {
    return { lookups: 0, problems: [`include:${domain} has no SPF record`] };
  }

  let lookups = 0;
  const problems: string[] = [];

  for (const term of records[0].trim().split(/\s+/).slice(1)) {
    const parsed = /^([+\-~?]?)([a-z0-9]+)([:=](.*))?$/i.exec(term);
    if (!parsed) continue;

    const mechanism = parsed[2].toLowerCase();
    const argument = parsed[4];

    if (!COSTS_A_LOOKUP.has(mechanism)) continue;

    lookups += 1;

    if ((mechanism === "include" || mechanism === "redirect") && argument) {
      const nested = await walkSpf(argument.toLowerCase(), state, depth + 1);
      lookups += nested.lookups;
      problems.push(...nested.problems);
    }
  }

  return { lookups, problems };
}

async function checkSpf(domain: string): Promise<SpfWalk> {
  const state = { queries: 1, seen: new Set<string>([domain]) };
  const records = findSpf(await txtRecords(domain));

  const walk: SpfWalk = {
    record: records[0] ?? null,
    recordCount: records.length,
    lookups: 0,
    breakdown: [],
    allQualifier: null,
    problems: [],
    queries: state.queries,
    truncated: false,
  };

  if (records.length === 0) return walk;
  if (records.length > 1) {
    // Two SPF records is a permerror in itself: a receiver cannot choose.
    walk.problems.push("more than one SPF record — receivers return permerror");
  }

  for (const term of records[0].trim().split(/\s+/).slice(1)) {
    const parsed = /^([+\-~?]?)([a-z0-9]+)([:=](.*))?$/i.exec(term);
    if (!parsed) continue;

    const qualifier = parsed[1] || "+";
    const mechanism = parsed[2].toLowerCase();
    const argument = parsed[4];

    if (mechanism === "all") {
      walk.allQualifier = `${qualifier}all`;
      continue;
    }

    if (mechanism === "ptr") {
      walk.problems.push("uses ptr, which RFC 7208 says should not be used");
    }

    if (!COSTS_A_LOOKUP.has(mechanism)) continue;

    let cost = 1;
    if ((mechanism === "include" || mechanism === "redirect") && argument) {
      const nested = await walkSpf(argument.toLowerCase(), state, 1);
      cost += nested.lookups;
      walk.problems.push(...nested.problems);
    }

    walk.lookups += cost;
    walk.breakdown.push({ term, cost });
  }

  walk.queries = state.queries;
  walk.truncated = state.queries >= MAX_QUERIES;
  return walk;
}

type DmarcCheck = {
  record: string | null;
  tags: Record<string, string>;
  problems: string[];
};

async function checkDmarc(domain: string): Promise<DmarcCheck> {
  const records = (await txtRecords(`_dmarc.${domain}`)).filter((record) =>
    /^v=DMARC1\s*;/i.test(record.trim()),
  );

  const check: DmarcCheck = { record: records[0] ?? null, tags: {}, problems: [] };
  if (!check.record) return check;
  if (records.length > 1) check.problems.push("more than one DMARC record");

  for (const pair of check.record.split(";")) {
    const [key, ...rest] = pair.split("=");
    if (!key?.trim() || rest.length === 0) continue;
    check.tags[key.trim().toLowerCase()] = rest.join("=").trim();
  }

  return check;
}

function describePolicy(policy: string | undefined): string {
  switch (policy) {
    case "reject":
      return "failing mail is rejected — the strongest setting";
    case "quarantine":
      return "failing mail goes to spam";
    case "none":
      return "monitoring only — failing mail is still delivered";
    default:
      return "no p= tag, which makes the record invalid";
  }
}

export async function checkMail(domain: string): Promise<ToolResult> {
  const name = normaliseHostname(domain);
  if (!name.includes(".")) {
    throw new ToolInputError(`"${domain}" is not a domain — try example.com`);
  }

  const [spf, dmarc] = await Promise.all([checkSpf(name), checkDmarc(name)]);

  const rows: string[][] = [];
  const add = (check: string, result: string, detail: string) => rows.push([check, result, detail]);

  // ---- SPF
  if (!spf.record) {
    add("SPF", "missing", "no v=spf1 record — anyone can send as this domain");
  } else {
    add("SPF", spf.recordCount > 1 ? `${spf.recordCount} records` : "found", spf.record);

    const budget = describeSpfBudget(spf.lookups);
    add("SPF lookups", budget.result, budget.detail);

    for (const entry of spf.breakdown) {
      add(`  ${entry.term}`, String(entry.cost), entry.cost > 1 ? "including its own includes" : "");
    }

    if (spf.allQualifier) {
      const meaning: Record<string, string> = {
        "-all": "fail — anything else is rejected, the recommended setting",
        "~all": "softfail — anything else is accepted but marked",
        "?all": "neutral — says nothing, so the record achieves little",
        "+all": "pass everything — this permits the whole internet to send as you",
      };
      add("SPF policy", spf.allQualifier, meaning[spf.allQualifier] ?? "");
    } else {
      add("SPF policy", "no all", "no all mechanism, so the record is open-ended");
    }
  }

  for (const problem of spf.problems) add("SPF problem", "warning", problem);
  if (spf.truncated) {
    add("SPF", "truncated", `stopped after ${MAX_QUERIES} lookups — the chain is unusually deep`);
  }

  // ---- DMARC
  if (!dmarc.record) {
    add("DMARC", "missing", "no _dmarc record — SPF and DKIM results are not acted on");
  } else {
    add("DMARC", "found", dmarc.record);
    add("DMARC policy", `p=${dmarc.tags.p ?? "none set"}`, describePolicy(dmarc.tags.p));

    if (dmarc.tags.sp) {
      add("Subdomain policy", `sp=${dmarc.tags.sp}`, describePolicy(dmarc.tags.sp));
    }

    const pct = dmarc.tags.pct ?? "100";
    add(
      "DMARC coverage",
      `pct=${pct}`,
      pct === "100" ? "applied to all mail" : `only ${pct}% of failing mail gets the policy`,
    );

    add(
      "DMARC reports",
      dmarc.tags.rua ? "rua set" : "none",
      dmarc.tags.rua ?? "no rua= address, so nobody receives the aggregate reports",
    );

    add("Alignment", `aspf=${dmarc.tags.aspf ?? "r"} adkim=${dmarc.tags.adkim ?? "r"}`,
      "r is relaxed, s is strict");
  }

  for (const problem of dmarc.problems) add("DMARC problem", "warning", problem);

  const notes = [
    `${spf.queries + 1} DNS queries via cloudflare-dns.com.`,
    "The 10-lookup budget is enforced by receiving mail servers, not by DNS — nothing",
    "warns the domain owner when it is exceeded.",
    "DKIM is not checked: its key lives at <selector>._domainkey, and DNS has no way",
    "to list which selectors exist.",
  ];

  return { kind: "rows", columns: ["Check", "Result", "Detail"], rows, note: notes.join(" ") };
}
