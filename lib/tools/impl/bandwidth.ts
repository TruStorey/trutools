import { ToolInputError, type ToolResult } from "../result";
import { humanise } from "./duration";

/**
 * Link rates, and how long a transfer actually takes.
 *
 * Two conventions collide here and the collision is the whole point. Network
 * rates are decimal without exception — 1 Mbps is 1,000,000 bits per second,
 * never 1,048,576 — while the file being moved is usually quoted in binary.
 * So "how long to move 1 TiB over 1 Gbps" spans a 10% gap between the two, and
 * that is where the answer people guess goes wrong.
 *
 * Then there is framing: Ethernet, IP and TCP headers mean throughput is a few
 * percent below line rate, so the honest answer is a little longer again.
 */

/** Bits per second. */
const RATE_UNITS: Record<string, number> = {
  bps: 1,
  kbps: 1e3,
  mbps: 1e6,
  gbps: 1e9,
  tbps: 1e12,
  "b/s": 8,
  "kb/s": 8e3,
  "mb/s": 8e6,
  "gb/s": 8e9,
  "tb/s": 8e12,
  "kib/s": 8 * 1024,
  "mib/s": 8 * 1024 ** 2,
  "gib/s": 8 * 1024 ** 3,
  "tib/s": 8 * 1024 ** 4,
};

/** Bytes. */
const SIZE_UNITS: Record<string, number> = {
  b: 1,
  byte: 1,
  bytes: 1,
  kb: 1e3,
  mb: 1e6,
  gb: 1e9,
  tb: 1e12,
  pb: 1e15,
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4,
  pib: 1024 ** 5,
};

export const RATE_UNIT_NAMES = ["bps", "kbps", "Mbps", "Gbps", "Tbps", "MB/s", "MiB/s"];

function lookup(table: Record<string, number>, unit: string, what: string): number {
  const factor = table[unit.trim().toLowerCase()];
  if (factor === undefined) {
    throw new ToolInputError(
      `unknown ${what} unit "${unit}" — try ${Object.keys(table).slice(0, 6).join(", ")}`,
    );
  }
  return factor;
}

function present(value: number): string {
  if (value === 0) return "0";
  if (!Number.isFinite(value)) return "too large";
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 1) return String(Number(value.toFixed(3)));
  return value.toPrecision(3);
}

export type BandwidthOptions = {
  rate: number;
  rateUnit: string;
  /** Optional: how much data to move, to get a transfer time. */
  size?: number;
  sizeUnit?: string;
  /** Protocol overhead as a percentage. Default 0, a realistic Ethernet+TCP figure is about 6. */
  overhead: number;
};

export const BANDWIDTH_DEFAULTS: BandwidthOptions = {
  rate: 1,
  rateUnit: "Gbps",
  overhead: 0,
};

export function convertBandwidth(options: BandwidthOptions): ToolResult {
  if (!Number.isFinite(options.rate) || options.rate <= 0) {
    throw new ToolInputError("rate must be a positive number");
  }
  if (options.overhead < 0 || options.overhead >= 100) {
    throw new ToolInputError("overhead must be between 0 and 99 percent");
  }

  const bitsPerSecond = options.rate * lookup(RATE_UNITS, options.rateUnit, "rate");
  const bytesPerSecond = bitsPerSecond / 8;

  const rows: string[][] = [
    ["bps", present(bitsPerSecond), "bits, decimal"],
    ["kbps", present(bitsPerSecond / 1e3), "bits, decimal"],
    ["Mbps", present(bitsPerSecond / 1e6), "bits, decimal"],
    ["Gbps", present(bitsPerSecond / 1e9), "bits, decimal"],
    ["B/s", present(bytesPerSecond), "bytes, decimal"],
    ["MB/s", present(bytesPerSecond / 1e6), "bytes, decimal"],
    ["GB/s", present(bytesPerSecond / 1e9), "bytes, decimal"],
    ["MiB/s", present(bytesPerSecond / 1024 ** 2), "bytes, binary"],
    ["GiB/s", present(bytesPerSecond / 1024 ** 3), "bytes, binary"],
  ];

  const notes = [
    `${present(options.rate)} ${options.rateUnit} is ${present(bytesPerSecond / 1e6)} MB/s.`,
    "Link rates are always decimal; file sizes usually are not, which is where the 10% surprise comes from.",
  ];

  if (options.size !== undefined) {
    if (!Number.isFinite(options.size) || options.size <= 0) {
      throw new ToolInputError("size must be a positive number");
    }

    const bytes = options.size * lookup(SIZE_UNITS, options.sizeUnit ?? "GiB", "size");
    const lineSeconds = bytes / bytesPerSecond;
    const realSeconds = lineSeconds / (1 - options.overhead / 100);

    rows.push(
      ["", "", ""],
      ["Transfer size", present(options.size), `${options.sizeUnit ?? "GiB"} = ${bytes.toLocaleString("en-US")} bytes`],
      ["Time at line rate", humanise(Math.round(lineSeconds)), `${present(lineSeconds)} seconds`],
    );

    if (options.overhead > 0) {
      rows.push([
        `Time with ${options.overhead}% overhead`,
        humanise(Math.round(realSeconds)),
        `${present(realSeconds)} seconds`,
      ]);
    } else {
      notes.push("Add overhead= for a figure that accounts for protocol framing; 6 is typical for TCP over Ethernet.");
    }
  }

  return {
    kind: "rows",
    columns: ["Unit", "Value", "Convention"],
    rows,
    note: notes.join(" "),
  };
}
