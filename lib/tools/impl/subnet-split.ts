import { ToolInputError, type ToolResult } from "../result";
import {
  blockSize,
  classifyIpv4,
  maskFor,
  parseCidr,
  usableRange,
  type ParsedCidr,
} from "./ip";

/**
 * Subdividing a block, in the style of Dave's Visual Subnet Calculator.
 *
 * The API splits evenly: count= or prefix=, computed arithmetically. The
 * uneven, click-it-together tree lives in the browser panel and stays there —
 * the `divide=` bit string that used to replay one through the API is gone,
 * along with the parser and serialiser that carried it.
 *
 * `Node` is still shared, because the panel's tree state is typed by it.
 */

export type Node = { children?: [Node, Node] };

export type Leaf = { network: bigint; prefix: number };

// ------------------------------------------------------------------ requests

export type SplitRequest = {
  cidr: string;
  /** Split into at least this many equal subnets. Rounded up to a power of two. */
  count?: number;
  /** Split down to this prefix length. */
  prefix?: number;
  limit: number;
  offset: number;
};

export const DEFAULT_LIMIT = 256;
export const MAX_LIMIT = 4096;

/**
 * A split is described, not built. `prefix=28` on a /8 is a million subnets —
 * materialising that tree would allocate millions of objects to then show 256
 * rows of it, so splits are computed arithmetically and no tree is ever held
 * in memory.
 */
type Plan = { kind: "uniform"; targetPrefix: number; note?: string };

/** Smallest depth d where 2^d >= count, without going through floating point. */
function depthFor(count: number): number {
  let depth = 0;
  while (1n << BigInt(depth) < BigInt(count)) depth += 1;
  return depth;
}

/** null means no split was asked for, i.e. show the summary instead. */
function planFor(parsed: ParsedCidr, request: SplitRequest): Plan | null {
  const given = [request.count, request.prefix].filter((value) => value !== undefined);

  if (given.length === 0) return null;
  if (given.length > 1) {
    throw new ToolInputError("give only one of count or prefix — they can disagree");
  }

  const maxDepth = parsed.family.size - parsed.prefix;
  if (maxDepth === 0) {
    throw new ToolInputError(
      `/${parsed.prefix} is a single address — there is nothing to split`,
    );
  }

  if (request.prefix !== undefined) {
    if (request.prefix <= parsed.prefix) {
      throw new ToolInputError(
        `prefix must be longer than /${parsed.prefix} to be a split of it`,
      );
    }
    if (request.prefix > parsed.family.size) {
      throw new ToolInputError(`prefix must be between 0 and ${parsed.family.size}`);
    }
    return { kind: "uniform", targetPrefix: request.prefix };
  }

  const count = request.count ?? 1;
  if (!Number.isFinite(count) || count < 1) throw new ToolInputError("count must be at least 1");

  const depth = depthFor(count);
  if (depth > maxDepth) {
    throw new ToolInputError(
      `/${parsed.prefix} splits into at most ${(1n << BigInt(maxDepth)).toLocaleString("en-US")} subnets`,
    );
  }

  // Halving is the only operation a binary tree has, so the count is rounded up
  // to the next power of two and the response says so — quietly returning 5
  // uneven blocks for count=5 would be a lie.
  const actual = 1n << BigInt(depth);
  return {
    kind: "uniform",
    targetPrefix: parsed.prefix + depth,
    note:
      actual === BigInt(count)
        ? undefined
        : `Rounded up to ${actual.toLocaleString("en-US")} — splits are always halves.`,
  };
}

// ----------------------------------------------------------------- rendering

/** The default response: what this block could be split into, and into how many. */
function summary(parsed: ParsedCidr): ToolResult {
  const { family, prefix, network, format } = parsed;
  const rows: string[][] = [];

  for (let target = prefix + 1; target <= family.size; target += 1) {
    const usable = usableRange(network, target, family);

    rows.push([
      `/${target}`,
      (1n << BigInt(target - prefix)).toLocaleString("en-US"),
      blockSize(family, target).toLocaleString("en-US"),
      usable.count.toLocaleString("en-US"),
      family.size === 32 ? format(maskFor(family, target)) : "",
    ]);
  }

  return {
    kind: "rows",
    columns: ["Prefix", "Subnets", "Addresses each", "Usable each", "Netmask"],
    rows,
    note: `${format(network)}/${prefix} — add count= or prefix= to get the subnets themselves.`,
  };
}

function rowFor(leaf: Leaf, parsed: ParsedCidr): string[] {
  const { family, format, isV6 } = parsed;
  const size = blockSize(family, leaf.prefix);
  const last = leaf.network + size - 1n;
  const usable = usableRange(leaf.network, leaf.prefix, family);

  if (isV6) {
    return [
      `${format(leaf.network)}/${leaf.prefix}`,
      `${format(leaf.network)} - ${format(last)}`,
      size.toLocaleString("en-US"),
    ];
  }

  return [
    `${format(leaf.network)}/${leaf.prefix}`,
    format(maskFor(family, leaf.prefix)),
    `${format(usable.first)} - ${format(usable.last)}`,
    usable.count.toLocaleString("en-US"),
    usable.broadcast === null ? "n/a" : format(usable.broadcast),
    classifyIpv4(leaf.network, leaf.prefix),
  ];
}

export function splitSubnet(request: SplitRequest): ToolResult {
  const parsed = parseCidr(request.cidr);
  const plan = planFor(parsed, request);
  if (!plan) return summary(parsed);

  const { family, network, prefix, isV6 } = parsed;
  const offset = Math.max(0, request.offset);
  const limit = Math.min(Math.max(1, request.limit), MAX_LIMIT);

  const depth = plan.targetPrefix - prefix;
  const total = 1n << BigInt(depth);

  const size = blockSize(family, plan.targetPrefix);
  const take = Number(
    total - BigInt(offset) < BigInt(limit) ? total - BigInt(offset) : BigInt(limit),
  );

  const page: Leaf[] = [];
  for (let i = 0; i < Math.max(0, take); i += 1) {
    page.push({
      network: network + (BigInt(offset) + BigInt(i)) * size,
      prefix: plan.targetPrefix,
    });
  }

  const notes: string[] = [];
  if (plan.note) notes.push(plan.note);
  notes.push(`${total.toLocaleString("en-US")} subnet(s) total.`);
  if (BigInt(page.length) < total) {
    notes.push(
      `Showing ${offset + 1}-${offset + page.length}. Use limit= (max ${MAX_LIMIT}) and offset= for the rest.`,
    );
  }
  return {
    kind: "rows",
    columns: isV6
      ? ["Subnet", "Range", "Addresses"]
      : ["Subnet", "Netmask", "Usable range", "Hosts", "Broadcast", "Type"],
    rows: page.map((leaf) => rowFor(leaf, parsed)),
    note: notes.join(" "),
  };
}
