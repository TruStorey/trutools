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
    if (value) return normalise(value);
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
