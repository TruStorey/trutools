/** pnpm dlx tsx --test lib/tools/impl/prototype-keys.test.ts */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ToolInputError } from "../result";
import { convertBandwidth } from "./bandwidth";
import { lintUnitFile } from "./systemd";

describe("lookup tables ignore Object.prototype", () => {
  for (const unit of ["constructor", "__proto__"]) {
    it(`rejects the rate unit ${unit}`, () => {
      assert.throws(() => convertBandwidth({ rate: 1, rateUnit: unit, overhead: 0 }), ToolInputError);
    });

    it(`rejects the size unit ${unit}`, () => {
      assert.throws(
        () => convertBandwidth({ rate: 1, rateUnit: "Gbps", size: 1, sizeUnit: unit, overhead: 0 }),
        ToolInputError,
      );
    });
  }

  it("does not treat constructor= as a misplaced directive", () => {
    const result = lintUnitFile("[Unit]\nDescription=x\nconstructor=y\n[Install]\nWantedBy=a\n");
    assert.equal(result.kind, "rows");
    assert.ok(result.kind === "rows" && !result.rows.some((row) => row[2].includes("belongs in")));
  });
});
