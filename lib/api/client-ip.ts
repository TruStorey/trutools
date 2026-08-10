import { parseIpv4, parseIpv6 } from "@/lib/tools/impl/ip";

/**
 * Working out the caller's public IP the way icanhazip does.
 *
 * icanhazip reports the address it was actually connected from and ignores
 * X-Forwarded-For entirely — send it `X-Forwarded-For: 1.2.3.4` and it still
 * tells you your real address. We cannot see the socket peer from a route
 * handler, so the equivalent has to be recovered from the forwarded chain.
 *
 * X-Forwarded-For reads `client, proxy1, proxy2`, each hop appending the peer
 * it saw. Everything to the LEFT of our own edge is caller-supplied and
 * therefore worthless: anyone can prepend whatever they like. Everything to
 * the RIGHT is our own infrastructure, which is on private addresses.
 *
 * So: scan from the right and take the first address that is publicly
 * routable. That skips the Docker and proxy hops, lands on the address our
 * edge genuinely observed, and cannot be moved by a spoofed header — an
 * attacker can only add entries further left.
 */

/** Set to e.g. "cf-connecting-ip" when a CDN in front is the authority. */
const TRUSTED_HEADER = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();

const UNKNOWN = "unknown";

/** Strips a port and the brackets around a literal IPv6 address. */
function normalise(raw: string): string {
  let value = raw.trim();

  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end > 0) return value.slice(1, end);
  }

  // "1.2.3.4:5678" has one colon and dots; a bare IPv6 has several colons.
  if (value.includes(".") && value.split(":").length === 2) {
    value = value.split(":")[0];
  }

  // Some proxies report IPv4 clients as ::ffff:1.2.3.4. Report the plain form.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped) return mapped[1];

  return value;
}

/** Non-routable IPv4 space: our own hops, and anything that cannot be a caller. */
function isPrivateIpv4(value: bigint): boolean {
  const octet = (shift: bigint) => Number((value >> shift) & 0xffn);
  const a = octet(24n);
  const b = octet(16n);

  if (a === 0) return true; // 0.0.0.0/8, "this network"
  if (a === 10) return true; // RFC 1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC 1918, and Docker's default
  if (a === 192 && b === 168) return true; // RFC 1918
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT, RFC 6598
  if (a >= 224) return true; // multicast and reserved

  return false;
}

function isPrivateIpv6(value: bigint): boolean {
  if (value === 0n || value === 1n) return true; // unspecified, loopback
  const top = (value >> 112n) & 0xffffn;
  if ((top & 0xfe00n) === 0xfc00n) return true; // unique local
  if ((top & 0xffc0n) === 0xfe80n) return true; // link-local
  if ((top & 0xff00n) === 0xff00n) return true; // multicast
  return false;
}

/** True when this parses as an IP at all, public or otherwise. */
export function isParseableAddress(candidate: string): boolean {
  const value = normalise(candidate);
  if (!value) return false;
  try {
    if (value.includes(":")) parseIpv6(value);
    else parseIpv4(value);
    return true;
  } catch {
    return false;
  }
}

/** True when this address could belong to someone out on the internet. */
export function isPublicAddress(candidate: string): boolean {
  const value = normalise(candidate);
  if (!value) return false;

  try {
    if (value.includes(":")) return !isPrivateIpv6(parseIpv6(value));
    return !isPrivateIpv4(parseIpv4(value));
  } catch {
    // Not an address we can parse — a hostname, "unknown", junk.
    return false;
  }
}

function forwardedChain(headers: Headers): string[] {
  const xff = headers.get("x-forwarded-for");
  if (!xff) return [];
  return xff
    .split(",")
    .map((part) => normalise(part))
    .filter(Boolean);
}

/**
 * The caller's public IP, as our edge saw it.
 *
 * Falls back to the nearest hop and then x-real-ip when nothing in the chain is
 * publicly routable — on a LAN or in local dev the honest answer is that
 * private address, not "unknown".
 */
export function clientIp(headers: Headers): string {
  if (TRUSTED_HEADER) {
    const value = headers.get(TRUSTED_HEADER)?.split(",")[0];
    // Must parse as an address. A misconfigured CLIENT_IP_HEADER pointing at
    // something that is not an IP should fall through to the chain rather than
    // report whatever string happened to be there.
    if (value && isParseableAddress(normalise(value))) return normalise(value);
  }

  const chain = forwardedChain(headers);

  for (let i = chain.length - 1; i >= 0; i -= 1) {
    if (isPublicAddress(chain[i])) return chain[i];
  }

  // Nothing routable in the chain. An explicitly set X-Real-IP is worth more
  // than a private hop — some servers inject a loopback X-Forwarded-For of
  // their own, and that should not outrank an address the operator set.
  const realIp = headers.get("x-real-ip");
  const normalisedRealIp = realIp ? normalise(realIp) : "";
  if (normalisedRealIp && isPublicAddress(normalisedRealIp)) return normalisedRealIp;

  if (chain.length > 0) return chain[chain.length - 1];
  if (normalisedRealIp) return normalisedRealIp;

  return UNKNOWN;
}

/**
 * What the rate limiter counts against.
 *
 * The same resolution, deliberately. It used to take the rightmost entry
 * unconditionally, which put every visitor in one bucket the moment a CDN sat
 * in front — the rightmost hop would be the CDN's edge, not the caller.
 */
export function rateLimitKey(headers: Headers): string {
  return clientIp(headers);
}

// ---------------------------------------------------------------- diagnosis

/** Headers a proxy might use to carry the caller's address. */
const FORWARDING_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "forwarded",
  "cf-connecting-ip",
  "true-client-ip",
  "x-client-ip",
  "x-cluster-client-ip",
  "fastly-client-ip",
  "x-forwarded-host",
  "x-forwarded-proto",
];

/**
 * Enabled outside production, or with IP_DEBUG=1.
 *
 * The chain contains the addresses of your own infrastructure hops, so this
 * stays off in production by default rather than handing them to anyone who
 * asks.
 */
export function ipDebugEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.IP_DEBUG === "1";
}

/**
 * Why the answer is what it is: every forwarding header that arrived, each
 * chain entry marked public or private, and which one was chosen.
 *
 * This distinguishes the two ways the reported address goes wrong — the chain
 * never carrying the caller at all, versus an infrastructure hop being in a
 * range that is not actually private.
 */
export function describeClientIp(headers: Headers): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [
    { label: "Resolved", value: clientIp(headers) },
  ];

  const chain = forwardedChain(headers);
  if (chain.length === 0) {
    fields.push({
      label: "X-Forwarded-For",
      value: "absent — nothing upstream is forwarding the caller's address",
    });
  } else {
    chain.forEach((entry, index) => {
      const position =
        index === 0 ? "leftmost, caller-supplied" : index === chain.length - 1 ? "nearest hop" : "hop";
      fields.push({
        label: `XFF[${index}]`,
        value: `${entry}  (${isPublicAddress(entry) ? "public" : "private"}, ${position})`,
      });
    });
  }

  for (const name of FORWARDING_HEADERS) {
    if (name === "x-forwarded-for") continue;
    const value = headers.get(name);
    if (value) fields.push({ label: name, value });
  }

  fields.push({
    label: "CLIENT_IP_HEADER",
    value: TRUSTED_HEADER ? TRUSTED_HEADER : "unset",
  });

  // The common Cloudflare/Coolify shape: TLS terminates at the origin, so
  // Traefik rewrites X-Forwarded-For from the tunnel peer, but the CDN's own
  // header rides through untouched. If one is present and unused, that is the
  // answer, so say it rather than leaving it to be inferred.
  const cdnHeader = ["cf-connecting-ip", "true-client-ip", "fastly-client-ip"].find(
    (name) => headers.get(name) && isParseableAddress(headers.get(name) ?? ""),
  );

  if (cdnHeader && !TRUSTED_HEADER) {
    fields.push({
      label: "Fix",
      value:
        `${cdnHeader} is present and holds ${normalise(headers.get(cdnHeader) ?? "")}. ` +
        `Set CLIENT_IP_HEADER=${cdnHeader} to use it.`,
    });
  }

  const anyPublic = chain.some((entry) => isPublicAddress(entry));
  fields.push({
    label: "Diagnosis",
    value: anyPublic
      ? "A publicly routable address is present and was used."
      : chain.length === 0
        ? "No forwarded address arrived. The proxy in front needs to set X-Forwarded-For."
        : "Every entry is private, so the caller's address is being dropped upstream. " +
          "If one of these IS meant to be the caller, its range is treated as private.",
  });

  return fields;
}
