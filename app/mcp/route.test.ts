/** pnpm dlx tsx --test app/mcp/route.test.ts */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAX_BODY_BYTES } from "@/lib/api/body";
import { MAX_ARGUMENT_LENGTH } from "@/lib/mcp/server";

import { POST } from "./route";

let caller = 0;

/** A fresh address per test, so they do not share a rate limit bucket. */
function send(body: string) {
  caller += 1;
  return POST(
    new Request("http://test/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "X-Forwarded-For": `203.0.113.${caller}`,
      },
      body,
    }),
  );
}

const call = (name: string, args: Record<string, unknown>, id = 1) => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: { name, arguments: args },
});

describe("POST /mcp", () => {
  it("answers a single message", async () => {
    const response = await send(JSON.stringify(call("generate_uuid", {})));
    assert.equal(response.status, 200);
    const { result } = await response.json();
    assert.equal(result.isError, undefined);
  });

  it("refuses a batch rather than running it on one rate limit hit", async () => {
    const batch = Array.from({ length: 50 }, (_, id) => call("generate_uuid", {}, id));
    const response = await send(JSON.stringify(batch));
    assert.equal(response.status, 400);
    const { error, result } = await response.json();
    assert.equal(error.code, -32600);
    assert.equal(result, undefined);
    assert.equal(response.headers.get("X-RateLimit-Remaining"), "59");
  });

  it("refuses an oversized body", async () => {
    const response = await send(" ".repeat(MAX_BODY_BYTES + 1));
    assert.equal(response.status, 413);
  });

  it("reports malformed JSON", async () => {
    const response = await send("{nope");
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, -32700);
  });

  it("caps arguments at what a URL can carry", async () => {
    const response = await send(
      JSON.stringify(call("convert_case", { text: "A".repeat(MAX_ARGUMENT_LENGTH + 1) })),
    );
    const { result } = await response.json();
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /16384 characters or fewer/);
  });

  it("leaves documents to the body limit", async () => {
    const response = await send(
      JSON.stringify(call("generate_hash", { body: "a".repeat(MAX_ARGUMENT_LENGTH + 1), algo: "sha256" })),
    );
    const { result } = await response.json();
    assert.equal(result.isError, undefined);
  });
});
