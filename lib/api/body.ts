/**
 * The most this service will read from one request body: 1 MiB.
 *
 * Every tool runs synchronously on the one event loop, so input size is the
 * thing that decides how long everyone else waits. A megabyte comfortably holds
 * any real certificate, unit file or config, and is applied here rather than in
 * the tools because the browser panels run the same functions on the visitor's
 * own CPU and need no such limit.
 *
 * next.config.ts sets the proxy's own buffer above this on purpose: past its
 * limit the proxy passes on a truncated body without saying so, and a cap below
 * that limit is what makes the truncation show up here as "too large" rather
 * than being computed over as though it were the whole input.
 */
export const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Whether the client has declared a body over the limit.
 *
 * proxy.ts asks this before rewriting a short-form request, because refusing
 * there is the only reliable place: once the rewrite's internal hop exists,
 * answering without reading all of the body can leave it waiting until the
 * socket dies, which is a 500 after several seconds rather than a 413.
 */
export function declaresTooLarge(headers: Headers): boolean {
  return Number(headers.get("content-length")) > MAX_BODY_BYTES;
}

/** The body as text, or null if it is over the limit. */
export async function readBody(
  request: Request,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<string | null> {
  if (request.body === null) return "";

  // Counted rather than trusting Content-Length, which can be absent or wrong.

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  // Past the limit the rest is read and discarded, not cancelled. Cancelling
  // leaves the connection unusable with no sign of it, and behind a reverse
  // proxy that connection is pooled: the next request down it, likely someone
  // else's, hangs until it resets.
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      received += value.byteLength;
      if (received <= maxBytes) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (received > maxBytes) return null;

  const whole = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    whole.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(whole);
}

export function bodyTooLargeMessage(): string {
  return `Request body is larger than the ${MAX_BODY_BYTES / 1024 / 1024} MiB limit.`;
}
