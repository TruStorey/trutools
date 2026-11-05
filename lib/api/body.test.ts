/** pnpm dlx tsx --test lib/api/body.test.ts */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { handleToolRequest } from "./tool-route";
import { declaresTooLarge, MAX_BODY_BYTES, readBody } from "./body";
import { MAX_YAML_LENGTH } from "./handlers";

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("http://test/api/v1/transform/text?op=count", { method: "POST", body, headers, duplex: "half" } as RequestInit);

/** No Content-Length, so only the counted read can catch it. */
function chunked(size: number) {
  const chunk = new Uint8Array(64 * 1024).fill(97);
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= size) return controller.close();
      sent += chunk.length;
      controller.enqueue(chunk);
    },
  });
}

describe("readBody", () => {
  it("returns text, multi-byte characters across chunks included", async () => {
    const bytes = new TextEncoder().encode("héllo");
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.subarray(0, 2));
        controller.enqueue(bytes.subarray(2));
        controller.close();
      },
    });
    assert.equal(await readBody(post(body)), "héllo");
  });

  it("accepts exactly the limit and refuses one byte over", async () => {
    assert.equal((await readBody(post("a".repeat(MAX_BODY_BYTES))))?.length, MAX_BODY_BYTES);
    assert.equal(await readBody(post("a".repeat(MAX_BODY_BYTES + 1))), null);
  });

  it("goes by the bytes that arrive, not the length declared", async () => {
    assert.equal(await readBody(post("a", { "content-length": String(MAX_BODY_BYTES + 1) })), "a");
    assert.equal(await readBody(post(chunked(MAX_BODY_BYTES * 3), { "content-length": "1" })), null);
  });

  it("refuses a stream that never declared its length", async () => {
    assert.equal(await readBody(post(chunked(MAX_BODY_BYTES * 3))), null);
  });
});

describe("the API", () => {
  it("answers an oversized body with 413", async () => {
    const response = await handleToolRequest(post(chunked(MAX_BODY_BYTES * 2)), "transform", "text");
    assert.equal(response.status, 413);
  });

  it("still handles a normal body", async () => {
    const response = await handleToolRequest(post("one\ntwo\n"), "transform", "text");
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Lines\s+2/);
  });
});

describe("readBody, over the limit", () => {
  it("reads to the end rather than abandoning the connection", async () => {
    let finished = false;
    const body = chunked(MAX_BODY_BYTES * 2);
    const watched = body.pipeThrough(new TransformStream({ flush: () => void (finished = true) }));
    assert.equal(await readBody(post(watched)), null);
    assert.equal(finished, true);
  });
});

describe("declaresTooLarge", () => {
  const declaring = (length?: number) =>
    new Headers(length === undefined ? {} : { "content-length": String(length) });

  it("refuses only a declared length over the limit", () => {
    assert.equal(declaresTooLarge(declaring(MAX_BODY_BYTES + 1)), true);
    assert.equal(declaresTooLarge(declaring(MAX_BODY_BYTES)), false);
    assert.equal(declaresTooLarge(declaring()), false);
  });
});

describe("yaml-json input limit", () => {
  const convert = (input: string) =>
    handleToolRequest(
      new Request("http://test/api/v1/convert/yaml-json", { method: "POST", body: input }),
      "convert",
      "yaml-json",
    );

  it("refuses more than the parser can safely take, quickly", async () => {
    const started = performance.now();
    const response = await convert('"'.repeat(MAX_YAML_LENGTH + 1));
    assert.equal(response.status, 400);
    assert.match(await response.text(), /KiB or smaller/);
    assert.ok(performance.now() - started < 200);
  });

  it("converts at the limit", async () => {
    const response = await convert("k: " + "a".repeat(MAX_YAML_LENGTH - 3));
    assert.equal(response.status, 200);
  });
});
