import { type ToolResult } from "../result";
import {
  blockSize,
  classifyIpv4,
  classifyIpv6,
  maskFor,
  parseCidr,
  usableRange,
} from "./ip";

/**
 * Facts about a single block. Splitting one up lives in subnet-split.ts; the
 * address maths both share lives in ip.ts.
 */
export function calculateSubnet(input: string): ToolResult {
  const { family, isV6, value, network, prefix, format } = parseCidr(input);

  const mask = maskFor(family, prefix);
  const total = blockSize(family, prefix);
  const broadcast = network + total - 1n;

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

  const wildcard = total - 1n;
  const usable = usableRange(network, prefix, family);

  fields.push(
    { label: "Netmask", value: `${format(mask)} (/${prefix})` },
    { label: "Wildcard", value: format(wildcard) },
    { label: "Broadcast", value: usable.broadcast === null ? "n/a" : format(usable.broadcast) },
    { label: "First usable", value: format(usable.first) },
    { label: "Last usable", value: format(usable.last) },
    { label: "Usable hosts", value: usable.count.toLocaleString("en-US") },
    { label: "Total addresses", value: total.toLocaleString("en-US") },
    { label: "Type", value: classifyIpv4(network, prefix) },
  );

  return { kind: "fields", fields };
}
