import { ToolInputError, type ToolResult } from "../result";

/**
 * IPv4 and IPv6 subnet maths, done in BigInt so one code path covers both.
 */

type Family = { bits: 4 | 6; size: 32 | 128 };

const V4: Family = { bits: 4, size: 32 };
const V6: Family = { bits: 6, size: 128 };

function parseIpv4(address: string): bigint {
  const parts = address.split(".");
  if (parts.length !== 4) throw new ToolInputError(`not a valid IPv4 address: ${address}`);

  let value = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      throw new ToolInputError(`not a valid IPv4 address: ${address}`);
    }
    const octet = Number(part);
    if (octet > 255) throw new ToolInputError(`octet out of range in ${address}`);
    value = (value << 8n) | BigInt(octet);
  }
  return value;
}

function formatIpv4(value: bigint): string {
  return [24n, 16n, 8n, 0n].map((shift) => (value >> shift) & 0xffn).join(".");
}

function parseIpv6(address: string): bigint {
  // Expand the :: shorthand into the right number of zero groups.
  const doubleColons = address.split("::").length - 1;
  if (doubleColons > 1) throw new ToolInputError(`not a valid IPv6 address: ${address}`);

  let groups: string[];
  if (doubleColons === 1) {
    const [head, tail] = address.split("::");
    const headGroups = head ? head.split(":") : [];
    const tailGroups = tail ? tail.split(":") : [];
    const missing = 8 - headGroups.length - tailGroups.length;
    if (missing < 0) throw new ToolInputError(`too many groups in ${address}`);
    groups = [...headGroups, ...Array(missing).fill("0"), ...tailGroups];
  } else {
    groups = address.split(":");
  }

  if (groups.length !== 8) throw new ToolInputError(`not a valid IPv6 address: ${address}`);

  let value = 0n;
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
      throw new ToolInputError(`not a valid IPv6 group: ${group}`);
    }
    value = (value << 16n) | BigInt(Number.parseInt(group, 16));
  }
  return value;
}

/** RFC 5952 canonical form: lowercase, longest zero run collapsed to ::. */
function formatIpv6(value: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i -= 1) {
    groups.push(((value >> BigInt(i * 16)) & 0xffffn).toString(16));
  }

  let bestStart = -1;
  let bestLength = 0;
  let runStart = -1;
  let runLength = 0;

  for (let i = 0; i < 8; i += 1) {
    if (groups[i] === "0") {
      if (runStart === -1) runStart = i;
      runLength += 1;
      if (runLength > bestLength) {
        bestStart = runStart;
        bestLength = runLength;
      }
    } else {
      runStart = -1;
      runLength = 0;
    }
  }

  // A single zero group is written as "0", not "::".
  if (bestLength < 2) return groups.join(":");

  const head = groups.slice(0, bestStart).join(":");
  const tail = groups.slice(bestStart + bestLength).join(":");
  return `${head}::${tail}`;
}

function classifyIpv4(network: bigint, prefix: number): string {
  const first = Number((network >> 24n) & 0xffn);
  const second = Number((network >> 16n) & 0xffn);

  if (first === 10) return "Private (RFC 1918)";
  if (first === 172 && second >= 16 && second <= 31) return "Private (RFC 1918)";
  if (first === 192 && second === 168) return "Private (RFC 1918)";
  if (first === 127) return "Loopback";
  if (first === 169 && second === 254) return "Link-local (APIPA)";
  if (first === 100 && second >= 64 && second <= 127) return "Carrier-grade NAT (RFC 6598)";
  if (first >= 224 && first <= 239) return "Multicast";
  if (first >= 240) return "Reserved";
  if (prefix === 32) return "Public (single host)";
  return "Public";
}

function classifyIpv6(network: bigint): string {
  const top = (network >> 112n) & 0xffffn;
  if (top === 0n && network === 1n) return "Loopback";
  if ((top & 0xfe00n) === 0xfc00n) return "Unique local (RFC 4193)";
  if ((top & 0xffc0n) === 0xfe80n) return "Link-local";
  if ((top & 0xff00n) === 0xff00n) return "Multicast";
  if ((top & 0xe000n) === 0x2000n) return "Global unicast";
  return "Reserved / unspecified";
}

export function calculateSubnet(input: string): ToolResult {
  const trimmed = input.trim();
  if (!trimmed) throw new ToolInputError("a CIDR block is required, e.g. 10.0.0.0/22");

  const [address, prefixPart] = trimmed.split("/");
  const isV6 = address.includes(":");
  const family = isV6 ? V6 : V4;

  // A bare address is treated as a single host rather than an error.
  const prefix = prefixPart === undefined ? family.size : Number(prefixPart);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > family.size) {
    throw new ToolInputError(`prefix must be between 0 and ${family.size}`);
  }

  const parse = isV6 ? parseIpv6 : parseIpv4;
  const format = isV6 ? formatIpv6 : formatIpv4;

  const value = parse(address);
  const hostBits = BigInt(family.size - prefix);
  const mask = hostBits === BigInt(family.size) ? 0n : ((1n << BigInt(prefix)) - 1n) << hostBits;

  const network = value & mask;
  const broadcast = network | ((1n << hostBits) - 1n);
  const total = 1n << hostBits;

  const fields: { label: string; value: string }[] = [
    { label: "Input", value: `${format(value)}/${prefix}` },
    { label: "Network", value: `${format(network)}/${prefix}` },
  ];

  if (isV6) {
    fields.push(
      { label: "First address", value: format(network) },
      { label: "Last address", value: format(broadcast) },
      { label: "Prefix length", value: `/${prefix}` },
      { label: "Total addresses", value: total.toLocaleString("en-US") },
      { label: "Type", value: classifyIpv6(network) },
    );
    return { kind: "fields", fields };
  }

  const wildcard = (1n << hostBits) - 1n;

  // /31 and /32 are the awkward cases. RFC 3021 makes both addresses in a /31
  // usable for point-to-point links, and a /32 is a single usable host — the
  // usual "total - 2" is wrong for both.
  let usableFirst: string;
  let usableLast: string;
  let usableCount: bigint;

  if (prefix === 32) {
    usableFirst = format(network);
    usableLast = format(network);
    usableCount = 1n;
  } else if (prefix === 31) {
    usableFirst = format(network);
    usableLast = format(broadcast);
    usableCount = 2n;
  } else {
    usableFirst = format(network + 1n);
    usableLast = format(broadcast - 1n);
    usableCount = total - 2n;
  }

  fields.push(
    { label: "Netmask", value: `${format(mask)} (/${prefix})` },
    { label: "Wildcard", value: format(wildcard) },
    { label: "Broadcast", value: prefix >= 31 ? "n/a" : format(broadcast) },
    { label: "First usable", value: usableFirst },
    { label: "Last usable", value: usableLast },
    { label: "Usable hosts", value: usableCount.toLocaleString("en-US") },
    { label: "Total addresses", value: total.toLocaleString("en-US") },
    { label: "Type", value: classifyIpv4(network, prefix) },
  );

  return { kind: "fields", fields };
}
