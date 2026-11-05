/** pnpm dlx tsx --test lib/tools/impl/cron.test.ts */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ToolInputError } from "../result";
import { explainCron, nextRuns, parseCron } from "./cron";

const explain = (expression: string, count = 5, timeZone = "UTC") =>
  explainCron({ expression, count, timeZone });

describe("names that exist on Object.prototype", () => {
  // The range used to compare as strings and never finish, hanging the process.
  for (const expression of [
    "0 0 1 __proto__-constructor *",
    "0 0 1 constructor-__proto__ *",
    "0 0 * * __proto__-constructor",
    "0 0 1 constructor *",
    "0 0 1 __proto__ *",
    "constructor",
    "__proto__",
  ]) {
    it(`rejects ${expression}`, () => {
      assert.throws(() => explain(expression), ToolInputError);
    });
  }

  it("still reads real aliases and macros", () => {
    assert.deepEqual(parseCron("0 0 1 jan-mar mon").fields[3].values, [1, 2, 3]);
    assert.equal(parseCron("@daily").expression, "0 0 * * *");
  });
});

describe("nextRuns", () => {
  const from = new Date("2026-03-07T12:00:00Z");
  const iso = (expression: string, count: number, zone: string) =>
    nextRuns(parseCron(expression), count, zone, from).map((run) => run.toISOString());

  it("finds a daily run across a spring-forward", () => {
    assert.deepEqual(iso("30 3 * * *", 3, "America/New_York"), [
      "2026-03-08T07:30:00.000Z",
      "2026-03-09T07:30:00.000Z",
      "2026-03-10T07:30:00.000Z",
    ]);
  });

  it("finds runs in a zone with a half-hour offset", () => {
    assert.deepEqual(iso("15 5 * * *", 1, "Asia/Kolkata"), ["2026-03-07T23:45:00.000Z"]);
  });

  it("keeps a run in the repeated hour when a zone falls back off the hour", () => {
    // Chatham goes back from 03:45 to 02:45, so 02:45 happens twice.
    const runs = nextRuns(
      parseCron("15,45 2 * * 0"),
      3,
      "Pacific/Chatham",
      new Date("2026-04-04T09:59:00Z"),
    ).map((run) => run.toISOString());

    assert.deepEqual(runs, [
      "2026-04-04T12:30:00.000Z",
      "2026-04-04T13:00:00.000Z",
      "2026-04-04T14:00:00.000Z",
    ]);
  });

  it("finds every minute of a matching hour", () => {
    assert.equal(iso("* 13 * * *", 61, "UTC").length, 61);
  });

  it("keeps fifty daily runs cheap", () => {
    const started = performance.now();
    explain("59 23 * * *", 50);
    assert.ok(performance.now() - started < 500);
  });
});
