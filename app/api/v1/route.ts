import { rateLimitKey } from "@/lib/api/client-ip";
import { buildIndex } from "@/lib/api/index-text";
import { rateLimit } from "@/lib/api/ratelimit";
import { preflight, text, tooManyRequests } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rate = await rateLimit(rateLimitKey(request.headers));
  if (!rate.ok) return tooManyRequests(rate);

  return text(buildIndex(), { rate });
}

export async function OPTIONS() {
  return preflight();
}
