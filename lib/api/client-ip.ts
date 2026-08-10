/**
 * Two different IPs, deliberately.
 *
 * X-Forwarded-For is a chain: `client, proxy1, proxy2`. Everything to the left
 * of the hop *we* control is attacker-controlled — a caller can send their own
 * XFF header and it gets prepended.
 *
 * So:
 *   - What we *report* to the user is the leftmost entry. That is what
 *     icanhazip does and what someone behind a corporate proxy expects to see.
 *   - What we *key the rate limiter on* is the rightmost entry — the peer our
 *     own reverse proxy (Traefik, in front of Coolify) actually observed.
 *     Keying on the leftmost value would make the limiter free to bypass by
 *     sending a random XFF on every request.
 *
 * These must not be collapsed into one function.
 */

function forwardedChain(headers: Headers): string[] {
  const xff = headers.get("x-forwarded-for");
  if (!xff) return [];
  return xff
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The address to show the caller. Client-supplied; never use for security decisions. */
export function reportedIp(headers: Headers): string {
  const chain = forwardedChain(headers);
  if (chain.length > 0) return chain[0];
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** The address to rate limit on. The nearest hop our proxy saw. */
export function rateLimitKey(headers: Headers): string {
  const chain = forwardedChain(headers);
  if (chain.length > 0) return chain[chain.length - 1];

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  // No proxy headers at all — local dev, or a misconfigured deployment.
  // Bucket these together rather than letting them all bypass the limiter.
  return "unknown";
}
