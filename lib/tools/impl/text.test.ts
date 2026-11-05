/** pnpm dlx tsx --test lib/tools/impl/text.test.ts */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { transformText } from "./text";

const sort = (input: string) =>
  transformText({ input, operation: "sort", separator: ",", dropEmpty: true });

describe("sort", () => {
  it("orders numbers by value", () => {
    assert.deepEqual(sort("host10\nhost9\nhost1"), {
      kind: "lines",
      lines: ["host1", "host9", "host10"],
    });
  });

  it("gets through a megabyte quickly", () => {
    const input = Array.from({ length: 150_000 }, (_, i) => String((i * 7919) % 150_001)).join("\n");
    const started = performance.now();
    sort(input);
    assert.ok(performance.now() - started < 2000);
  });
});
