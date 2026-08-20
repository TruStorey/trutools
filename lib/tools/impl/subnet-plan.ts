import { ToolInputError, type ToolResult } from "../result";
import {
  blockSize,
  classifyIpv4,
  maskFor,
  parseCidr,
  rangeToCidrs,
  usableRange,
  type Family,
} from "./ip";

/**
 * VLSM allocation: a parent block and a list of things that have to fit in it,
 * out comes the plan.
 *
 * This is what people are actually doing when they carve a block up by hand —
 * "a /24 for management, something big enough for four thousand pods, a small
 * DMZ" — and unlike a click-to-divide tree it says the whole thing in one line
 * of text, so the browser and `curl` get the same tool rather than a rich
 * version and a stunted one.
 *
 * Splitting a block into equal halves lives in subnet-split.ts; the address
 * maths both share lives in ip.ts.
 */

/** Above this the response stops being something you read and starts being a dump. */
const MAX_REQUIREMENTS = 128;

/** Free blocks past this many are counted rather than listed. */
const MAX_FREE_SHOWN = 12;

type Requirement = {
  name: string;
  prefix: number;
  /** What the caller actually asked for — "4000" or "/26" — echoed back. */
  asked: string;
};

/**
 * Smallest block that holds this many hosts, as a prefix length.
 *
 * Floored at /30 for IPv4 on purpose. `usableRange` is right that a /31 holds
 * two usable addresses under RFC 3021, but handing someone a /31 because they
 * typed "2" is a surprise anywhere other than a point-to-point link. Asking for
 * `/31` explicitly still works — this only affects the host-count path.
 */
function prefixForHosts(hosts: bigint, family: Family, parentPrefix: number): number {
  const smallest = family.size === 32 ? 30 : family.size;

  for (let prefix = smallest; prefix >= parentPrefix; prefix -= 1) {
    if (usableRange(0n, prefix, family).count >= hosts) return prefix;
  }

  throw new ToolInputError(
    `${hosts.toLocaleString("en-US")} hosts will not fit in a /${parentPrefix}`,
  );
}

/**
 * "pods:4000,mgmt:200,dmz:/26" — a name is optional, a size is not. Split on the
 * first colon only, so the name is whatever came before it.
 */
function parseNeed(need: string, family: Family, parentPrefix: number): Requirement[] {
  const entries = need
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) {
    throw new ToolInputError('need is empty — try need=pods:4000,mgmt:200,dmz:/26');
  }
  if (entries.length > MAX_REQUIREMENTS) {
    throw new ToolInputError(`at most ${MAX_REQUIREMENTS} subnets can be planned at once`);
  }

  return entries.map((entry, index) => {
    const colon = entry.indexOf(":");
    const name = colon === -1 ? String(index + 1) : entry.slice(0, colon).trim();
    const size = (colon === -1 ? entry : entry.slice(colon + 1)).trim();

    if (!name) throw new ToolInputError(`entry ${index + 1} has a colon but no name`);
    if (!size) throw new ToolInputError(`"${name}" has no size — give a host count or a /prefix`);

    if (size.startsWith("/")) {
      const prefix = Number(size.slice(1));
      if (!Number.isInteger(prefix) || prefix < 0 || prefix > family.size) {
        throw new ToolInputError(`"${name}": prefix must be between 0 and ${family.size}`);
      }
      if (prefix < parentPrefix) {
        throw new ToolInputError(
          `"${name}": /${prefix} is bigger than the /${parentPrefix} it has to fit inside`,
        );
      }
      return { name, prefix, asked: `/${prefix}` };
    }

    if (!/^\d+$/.test(size)) {
      throw new ToolInputError(
        `"${name}": "${size}" is neither a host count nor a /prefix`,
      );
    }

    const hosts = BigInt(size);
    if (hosts < 1n) throw new ToolInputError(`"${name}": a subnet needs at least one host`);

    return { name, prefix: prefixForHosts(hosts, family, parentPrefix), asked: size };
  });
}

export type PlanRequest = {
  cidr: string;
  need: string;
};

export type Allocation = Requirement & { network: bigint };

/**
 * First-fit decreasing, which for power-of-two blocks is just a cursor walk.
 *
 * No alignment step is needed and that is worth stating, because its absence
 * looks like a bug: allocating largest-first means the cursor is always a sum
 * of blocks at least as large as the next one, so it is already a multiple of
 * that block's size. Packing is therefore perfect — the only gap is whatever is
 * left at the end.
 */
export function allocate(
  requirements: Requirement[],
  network: bigint,
  family: Family,
): Allocation[] {
  // Stable, so equal sizes come out in the order they were asked for.
  const ordered = [...requirements].sort((a, b) => a.prefix - b.prefix);

  const allocations: Allocation[] = [];
  let cursor = network;

  for (const requirement of ordered) {
    allocations.push({ ...requirement, network: cursor });
    cursor += blockSize(family, requirement.prefix);
  }

  return allocations;
}

export function planSubnets(request: PlanRequest): ToolResult {
  const { family, isV6, network, prefix, format } = parseCidr(request.cidr);

  const requirements = parseNeed(request.need, family, prefix);
  const capacity = blockSize(family, prefix);

  // Checked up front so an over-subscribed plan says so, rather than laying out
  // the ones that happened to fit and going quiet about the rest.
  const wanted = requirements.reduce(
    (total, requirement) => total + blockSize(family, requirement.prefix),
    0n,
  );
  if (wanted > capacity) {
    throw new ToolInputError(
      `these subnets need ${wanted.toLocaleString("en-US")} addresses but ` +
        `${format(network)}/${prefix} only has ${capacity.toLocaleString("en-US")} — ` +
        `${(wanted - capacity).toLocaleString("en-US")} short`,
    );
  }

  const allocations = allocate(requirements, network, family);

  const end = network + capacity - 1n;
  const used = allocations.reduce(
    (total, allocation) => total + blockSize(family, allocation.prefix),
    0n,
  );
  const free = network + used > end ? [] : rangeToCidrs(network + used, end, family);

  const rows = allocations.map((allocation) => {
    const size = blockSize(family, allocation.prefix);
    const usable = usableRange(allocation.network, allocation.prefix, family);
    const subnet = `${format(allocation.network)}/${allocation.prefix}`;

    if (isV6) {
      return [
        allocation.name,
        subnet,
        `${format(allocation.network)} - ${format(allocation.network + size - 1n)}`,
        size.toLocaleString("en-US"),
        allocation.asked,
      ];
    }

    return [
      allocation.name,
      subnet,
      format(maskFor(family, allocation.prefix)),
      `${format(usable.first)} - ${format(usable.last)}`,
      usable.count.toLocaleString("en-US"),
      allocation.asked,
    ];
  });

  const notes = [
    `${used.toLocaleString("en-US")} of ${capacity.toLocaleString("en-US")} addresses ` +
      `allocated (${((Number(used) / Number(capacity)) * 100).toFixed(1)}%) in ` +
      `${format(network)}/${prefix}${isV6 ? "" : ` — ${classifyIpv4(network, prefix)}`}.`,
  ];

  if (free.length === 0) {
    notes.push("No space left.");
  } else {
    const shown = free
      .slice(0, MAX_FREE_SHOWN)
      .map((block) => `${format(block.network)}/${block.prefix}`)
      .join(", ");
    notes.push(
      free.length > MAX_FREE_SHOWN
        ? `Free: ${shown}, and ${free.length - MAX_FREE_SHOWN} more block(s).`
        : `Free: ${shown}`,
    );
  }

  return {
    kind: "rows",
    columns: isV6
      ? ["Name", "Subnet", "Range", "Addresses", "Needed"]
      : ["Name", "Subnet", "Netmask", "Usable range", "Hosts", "Needed"],
    rows,
    note: notes.join(" "),
  };
}
