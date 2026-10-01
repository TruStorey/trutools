import { rateLimitKey } from "@/lib/api/client-ip";
import { buildVerbIndex } from "@/lib/api/index-text";
import { rateLimit } from "@/lib/api/ratelimit";
import { failure, preflight, text, tooManyRequests } from "@/lib/api/respond";
import { isVerb } from "@/lib/tools/registry";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ verb: string }>;
};

/** The index for one verb — what /generate answers to curl. */
export async function GET(request: Request, context: RouteContext) {
  const rate = await rateLimit(rateLimitKey(request.headers));
  if (!rate.ok) return tooManyRequests(rate);

  const { verb } = await context.params;
  if (!isVerb(verb)) {
    return failure(
      `No verb named "${verb}". See ${SITE_URL}/api/v1 for the list of endpoints.`,
      404,
      "text",
      rate,
    );
  }

  return text(buildVerbIndex(verb), { rate });
}

export async function OPTIONS() {
  return preflight();
}
