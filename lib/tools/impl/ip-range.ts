import { ToolInputError, type ToolResult } from "../result";
import {
  blockSize,
  formatIpv4,
  formatIpv6,
  parseIpv4,
  parseIpv6,
  V4,
  V6,
  type Family,
} from "./ip";

/**
 * Arbitrary address ranges to the smallest set of CIDR blocks that covers them
 * exactly, and back.
 *
 * A firewall or route table wants CIDRs; humans think in "from here to there".
 * The conversion is not obvious because a range only aligns to a block when
 * both its start and its length line up, so 10.0.0.5-10.0.0.30 needs five
 * blocks of different sizes rather than one.
 */

type Endpoint = { value: bigint; family: Family };

function parseAddress(input: string): Endpoint {
  const trimmed = input.trim();
  if (!trimmed) throw new ToolInputError("an address is required");

  if (trimmed.includes(":")) return { value: parseIpv6(trimmed), family: V6 };
  return { value: parseIpv4(trimmed), family: V4 };
}

const formatFor = (family: Family) => (family.size === 128 ? formatIpv6 : formatIpv4);

/** How many low bits of this value are zero — the largest block it can start. */
function trailingZeroBits(value: bigint, max: number): number {
  if (value === 0n) return max;
  let bits = 0;
  while ((value & (1n << BigInt(bits))) === 0n) bits += 1;
  return bits;
}

/** Highest power of two not exceeding the count, as a bit width. */
function widthFor(count: bigint): number {
  let bits = 0;
  while (1n << BigInt(bits + 1) <= count) bits += 1;
  return bits;
}

/**
 * The greedy walk: at each step take the largest block that both starts on the
 * current address and fits inside what is left. This is minimal — any larger
 * block would either be misaligned or overshoot.
 */
export function rangeToCidrs(
  start: bigint,
  end: bigint,
  family: Family,
): { network: bigint; prefix: number }[] {
  if (start > end) throw new ToolInputError("the range runs backwards — start is after end");

  const blocks: { network: bigint; prefix: number }[] = [];
  let cursor = start;

  while (cursor <= end) {
    const alignment = trailingZeroBits(cursor, family.size);
    const remaining = end - cursor + 1n;
    const bits = Math.min(alignment, widthFor(remaining));

    blocks.push({ network: cursor, prefix: family.size - bits });
    cursor += 1n << BigInt(bits);

    // A /0 block consumes the whole space and would wrap to zero.
    if (bits === family.size) break;
  }

  return blocks;
}

export type IpRangeOptions = {
  /** "10.0.0.5-10.0.0.30", or a single CIDR to expand into its range. */
  input: string;
};

export function convertIpRange(options: IpRangeOptions): ToolResult {
  const raw = options.input.trim();
  if (!raw) {
    throw new ToolInputError("a range or CIDR is required, e.g. 10.0.0.5-10.0.0.30");
  }

  // A CIDR goes the other way: show the range it covers.
  if (raw.includes("/")) {
    const [address, prefixPart] = raw.split("/");
    const { value, family } = parseAddress(address);
    const prefix = Number(prefixPart);

    if (!Number.isInteger(prefix) || prefix < 0 || prefix > family.size) {
      throw new ToolInputError(`prefix must be between 0 and ${family.size}`);
    }

    const format = formatFor(family);
    const size = blockSize(family, prefix);
    const hostBits = BigInt(family.size - prefix);
    const network = (value >> hostBits) << hostBits;

    return {
      kind: "fields",
      fields: [
        { label: "CIDR", value: `${format(network)}/${prefix}` },
        { label: "First", value: format(network) },
        { label: "Last", value: format(network + size - 1n) },
        { label: "Range", value: `${format(network)}-${format(network + size - 1n)}` },
        { label: "Addresses", value: size.toLocaleString("en-US") },
      ],
    };
  }

  const separator = raw.includes("-") ? "-" : raw.includes("..") ? ".." : null;
  if (!separator) {
    throw new ToolInputError(
      'give a range like "10.0.0.5-10.0.0.30", or a CIDR to see the range it covers',
    );
  }

  const [startRaw, endRaw] = raw.split(separator);
  const start = parseAddress(startRaw);
  const end = parseAddress(endRaw);

  if (start.family.size !== end.family.size) {
    throw new ToolInputError("the range mixes IPv4 and IPv6");
  }

  const family = start.family;
  const format = formatFor(family);
  const blocks = rangeToCidrs(start.value, end.value, family);
  const total = end.value - start.value + 1n;

  return {
    kind: "rows",
    columns: ["CIDR", "First", "Last", "Addresses"],
    rows: blocks.map((block) => {
      const size = blockSize(family, block.prefix);
      return [
        `${format(block.network)}/${block.prefix}`,
        format(block.network),
        format(block.network + size - 1n),
        size.toLocaleString("en-US"),
      ];
    }),
    note:
      `${format(start.value)}-${format(end.value)} is ${total.toLocaleString("en-US")} addresses ` +
      `in ${blocks.length} block(s). This is the smallest set that covers the range exactly.`,
  };
}
