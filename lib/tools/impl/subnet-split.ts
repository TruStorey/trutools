import { ToolInputError, type ToolResult } from "../result";
import {
  blockSize,
  classifyIpv4,
  maskFor,
  parseCidr,
  usableRange,
  type Family,
  type ParsedCidr,
} from "./ip";

/**
 * Subdividing a block, in the style of Dave's Visual Subnet Calculator.
 *
 * The state is a binary tree: every node is either a leaf or divided into
 * exactly two halves. Because you divide individual nodes, leaves end up at
 * different depths, which is where the mixed prefix lengths come from.
 *
 * The tree serialises to the same pre-order bit string davidc.net uses —
 * `1` for a divided node followed by its two children, `0` for a leaf — so a
 * tree clicked together in the browser can be replayed through the API.
 *
 * davidc.net packs that bit string into its URL as `<bitlength>.<hex>`, four
 * bits per nibble, least-significant bit first. `divide=` accepts either form,
 * so an existing bookmark from the original calculator can be pasted straight
 * in.
 */

export type Node = { children?: [Node, Node] };

/** Pre-order: "1" + left + right for a divided node, "0" for a leaf. */
export function serialiseTree(node: Node): string {
  if (!node.children) return "0";
  return `1${serialiseTree(node.children[0])}${serialiseTree(node.children[1])}`;
}

/**
 * davidc.net's packed URL form: "7.31" is 7 bits, nibbles LSB-first.
 * Returns the input untouched when it is already a raw bit string.
 */
export function unpackDivision(value: string): string {
  const match = /^(\d+)\.([0-9a-f]+)$/i.exec(value.trim());
  if (!match) return value.trim();

  const length = Number(match[1]);
  const hex = match[2].toLowerCase();

  if (hex.length < Math.ceil(length / 4)) {
    throw new ToolInputError(
      `divide says ${length} bits but only ${hex.length} hex character(s) follow`,
    );
  }

  let bits = "";
  for (let i = 0; i < length; i += 1) {
    const nibble = Number.parseInt(hex[Math.floor(i / 4)], 16);
    bits += nibble & (1 << i % 4) ? "1" : "0";
  }
  return bits;
}

/**
 * Strict inverse of serialiseTree. Rejects anything that is not exactly one
 * well-formed tree — trailing characters are an error rather than ignored, so
 * a truncated string cannot silently produce a smaller tree than intended.
 */
export function parseTree(input: string): Node {
  const bits = unpackDivision(input);

  if (!/^[01]+$/.test(bits)) {
    throw new ToolInputError('divide must be a string of 0s and 1s, e.g. "110100"');
  }

  let index = 0;

  function read(): Node {
    if (index >= bits.length) {
      throw new ToolInputError("divide ended early — a 1 is missing one of its two halves");
    }
    const bit = bits[index];
    index += 1;
    if (bit === "0") return {};
    return { children: [read(), read()] };
  }

  const tree = read();

  if (index !== bits.length) {
    throw new ToolInputError(
      `divide has ${bits.length - index} character(s) left over after a complete tree`,
    );
  }

  return tree;
}

/** A balanced tree of the given depth: 2^depth equal leaves. */
export function balancedTree(depth: number): Node {
  if (depth <= 0) return {};
  return { children: [balancedTree(depth - 1), balancedTree(depth - 1)] };
}

export type Leaf = { network: bigint; prefix: number };

/** Left-to-right, so the leaves come back in address order. */
export function leaves(node: Node, network: bigint, prefix: number, family: Family): Leaf[] {
  if (!node.children) return [{ network, prefix }];

  const half = blockSize(family, prefix + 1);
  return [
    ...leaves(node.children[0], network, prefix + 1, family),
    ...leaves(node.children[1], network + half, prefix + 1, family),
  ];
}

/** How many bits past the base prefix the deepest leaf sits. */
export function treeDepth(node: Node): number {
  if (!node.children) return 0;
  return 1 + Math.max(treeDepth(node.children[0]), treeDepth(node.children[1]));
}

// ------------------------------------------------------------------ requests

export type SplitRequest = {
  cidr: string;
  /** Split into at least this many equal subnets. Rounded up to a power of two. */
  count?: number;
  /** Split down to this prefix length. */
  prefix?: number;
  /** An explicit division tree, as produced by the browser panel. */
  divide?: string;
  limit: number;
  offset: number;
};

export const DEFAULT_LIMIT = 256;
export const MAX_LIMIT = 4096;

/** Above this many leaves the divide= string is longer than it is useful. */
const MAX_SERIALISED_LEAVES = 512;

/**
 * An even split is described, not built. `prefix=28` on a /8 is a million
 * subnets — materialising that tree would allocate millions of objects to then
 * show 256 rows of it, so uniform splits are computed arithmetically and only
 * an explicit `divide=` tree is ever held in memory (and that one is bounded by
 * the length of the string that produced it).
 */
type Plan =
  | { kind: "uniform"; targetPrefix: number; note?: string }
  | { kind: "tree"; tree: Node };

/** Smallest depth d where 2^d >= count, without going through floating point. */
function depthFor(count: number): number {
  let depth = 0;
  while (1n << BigInt(depth) < BigInt(count)) depth += 1;
  return depth;
}

/** null means no split was asked for, i.e. show the summary instead. */
function planFor(parsed: ParsedCidr, request: SplitRequest): Plan | null {
  const given = [request.count, request.prefix, request.divide].filter(
    (value) => value !== undefined,
  );

  if (given.length === 0) return null;
  if (given.length > 1) {
    throw new ToolInputError("give only one of count, prefix or divide — they can disagree");
  }

  const maxDepth = parsed.family.size - parsed.prefix;
  if (maxDepth === 0) {
    throw new ToolInputError(
      `/${parsed.prefix} is a single address — there is nothing to split`,
    );
  }

  if (request.divide !== undefined) {
    const tree = parseTree(request.divide);
    const depth = treeDepth(tree);
    if (depth > maxDepth) {
      throw new ToolInputError(
        `divide goes ${depth} levels deep, which would pass /${parsed.family.size} from /${parsed.prefix}`,
      );
    }
    return { kind: "tree", tree };
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
    note: `${format(network)}/${prefix} — add count=, prefix= or divide= to get the subnets themselves.`,
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

  let total: bigint;
  let page: Leaf[];
  let divideString: string | null;

  if (plan.kind === "uniform") {
    const depth = plan.targetPrefix - prefix;
    total = 1n << BigInt(depth);

    const size = blockSize(family, plan.targetPrefix);
    const take = Number(
      total - BigInt(offset) < BigInt(limit) ? total - BigInt(offset) : BigInt(limit),
    );

    page = [];
    for (let i = 0; i < Math.max(0, take); i += 1) {
      page.push({
        network: network + (BigInt(offset) + BigInt(i)) * size,
        prefix: plan.targetPrefix,
      });
    }

    // Only worth echoing while it is short enough to paste back.
    divideString =
      total <= BigInt(MAX_SERIALISED_LEAVES) ? serialiseTree(balancedTree(depth)) : null;
  } else {
    const all = leaves(plan.tree, network, prefix, family);
    total = BigInt(all.length);
    page = all.slice(offset, offset + limit);
    divideString = serialiseTree(plan.tree);
  }

  const notes: string[] = [];
  if (plan.kind === "uniform" && plan.note) notes.push(plan.note);
  notes.push(`${total.toLocaleString("en-US")} subnet(s) total.`);
  if (BigInt(page.length) < total) {
    notes.push(
      `Showing ${offset + 1}-${offset + page.length}. Use limit= (max ${MAX_LIMIT}) and offset= for the rest.`,
    );
  }
  if (divideString) notes.push(`divide=${divideString}`);

  return {
    kind: "rows",
    columns: isV6
      ? ["Subnet", "Range", "Addresses"]
      : ["Subnet", "Netmask", "Usable range", "Hosts", "Broadcast", "Type"],
    rows: page.map((leaf) => rowFor(leaf, parsed)),
    note: notes.join(" "),
  };
}
