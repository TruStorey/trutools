import { ToolInputError, type ToolResult } from "../result";

/**
 * Data size conversion, keeping the two conventions apart.
 *
 * kB is 1000 bytes and KiB is 1024. Disk vendors use the first, operating
 * systems mostly report the second, and the gap is the entire reason a 1 TB
 * drive shows up as 931 GB. Both are listed side by side rather than picking
 * a side.
 */

const DECIMAL = ["B", "kB", "MB", "GB", "TB", "PB", "EB"] as const;
const BINARY = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"] as const;

type UnitTable = { units: readonly string[]; base: number };

const TABLES: UnitTable[] = [
  { units: DECIMAL, base: 1000 },
  { units: BINARY, base: 1024 },
];

/** Every accepted unit, mapped to how many bytes one of it is. */
const FACTORS = new Map<string, number>();
for (const { units, base } of TABLES) {
  units.forEach((unit, power) => FACTORS.set(unit.toLowerCase(), base ** power));
}
// Common shorthands people actually type.
FACTORS.set("k", 1000);
FACTORS.set("m", 1000 ** 2);
FACTORS.set("g", 1000 ** 3);
FACTORS.set("t", 1000 ** 4);
FACTORS.set("byte", 1);
FACTORS.set("bytes", 1);

export const KNOWN_UNITS = [...DECIMAL, ...BINARY.slice(1)];

/** Binary units only — "B" is in both tables and says nothing either way. */
const BINARY_ONLY = new Set(BINARY.slice(1).map((unit) => unit.toLowerCase()));

export type ParsedSize = { bytes: number; binary: boolean };

/**
 * A size written the way people write it: "100TB", "1.5 TiB", "512GiB". A bare
 * number is bytes.
 *
 * The convention comes back alongside the value, because anything reporting a
 * size should report it in the convention it was handed — answering a question
 * asked in TiB with a number in TB is how you end up arguing about 931 GB.
 */
export function parseSize(input: string, field: string): ParsedSize {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]*)\s*$/.exec(input);
  if (!match) {
    throw new ToolInputError(`${field} must be a size like 100TB or 512GiB, got "${input}"`);
  }

  const [, amount, unit] = match;
  const key = (unit || "B").toLowerCase();

  const factor = FACTORS.get(key);
  if (factor === undefined) {
    throw new ToolInputError(
      `${field}: unknown unit "${unit}" — try one of ${KNOWN_UNITS.join(", ")}`,
    );
  }

  return { bytes: Number(amount) * factor, binary: BINARY_ONLY.has(key) };
}

/** The largest unit the value is still at least 1 of, in the given convention. */
export function humanSize(bytes: number, binary: boolean): string {
  const units = binary ? BINARY : DECIMAL;
  const base = binary ? 1024 : 1000;

  let power = 0;
  while (bytes >= base ** (power + 1) && power < units.length - 1) power += 1;

  return `${present(bytes / base ** power)} ${units[power]}`;
}

export type BytesOptions = {
  value: number;
  from: string;
  /** A single target unit, or undefined for the whole table. */
  to?: string;
};

export const BYTES_DEFAULTS: BytesOptions = { value: 1, from: "GB" };

function factorFor(unit: string): number {
  const factor = FACTORS.get(unit.trim().toLowerCase());
  if (factor === undefined) {
    throw new ToolInputError(
      `unknown unit "${unit}" — try one of ${KNOWN_UNITS.join(", ")}`,
    );
  }
  return factor;
}

/** Enough precision to be useful without printing floating-point noise. */
function present(value: number): string {
  if (value === 0) return "0";
  if (!Number.isFinite(value)) return "too large";

  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 1) return String(Number(value.toFixed(4)));
  return value.toPrecision(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function convertBytes(options: BytesOptions): ToolResult {
  if (!Number.isFinite(options.value)) throw new ToolInputError("value must be a number");
  if (options.value < 0) throw new ToolInputError("value cannot be negative");

  const bytes = options.value * factorFor(options.from);

  if (options.to) {
    return { kind: "text", text: present(bytes / factorFor(options.to)) };
  }

  const rows: string[][] = [];
  DECIMAL.forEach((decimalUnit, index) => {
    const binaryUnit = BINARY[index];
    rows.push([
      present(bytes / 1000 ** index),
      decimalUnit,
      present(bytes / 1024 ** index),
      binaryUnit,
    ]);
  });

  return {
    kind: "rows",
    columns: ["Decimal", "Unit", "Binary", "Unit"],
    rows,
    note: `${present(options.value)} ${options.from} is ${bytes.toLocaleString("en-US")} bytes. Decimal steps by 1000, binary by 1024.`,
  };
}
