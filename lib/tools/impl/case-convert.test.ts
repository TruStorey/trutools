/** pnpm dlx tsx --test lib/tools/impl/case-convert.test.ts */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toWords } from "./case-convert";

describe("toWords", () => {
  it("keeps acronyms whole", () => {
    assert.deepEqual(toWords("parseHTTPResponse"), ["parse", "HTTP", "Response"]);
    assert.deepEqual(toWords("HTTPResponse"), ["HTTP", "Response"]);
    assert.deepEqual(toWords("ABCdEFg"), ["AB", "Cd", "E", "Fg"]);
    assert.deepEqual(toWords("aBC"), ["a", "BC"]);
  });

  it("stays linear on a long capital run", () => {
    const started = performance.now();
    toWords("A".repeat(1024 * 1024));
    assert.ok(performance.now() - started < 500);
  });
});
