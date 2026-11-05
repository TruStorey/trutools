/** pnpm dlx tsx --test lib/tools/result.test.ts */
import assert from "node:assert/strict";
import { it } from "node:test";

import { formatResult } from "./format";

it("renders more rows than can be spread into a function call", () => {
  const rows = Array.from({ length: 300_000 }, () => ["1", "error", "x"]);
  const output = formatResult("t", { kind: "rows", columns: ["A", "B", "C"], rows }, "text");
  assert.ok(output.length > rows.length);
});
