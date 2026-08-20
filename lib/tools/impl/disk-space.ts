import { ToolInputError, type ToolResult } from "../result";
import { humanSize, parseSize } from "./bytes";

/**
 * Disk usage from any two of capacity, used and percentage.
 *
 * Three quantities, one relationship — used = capacity × percent — so any two
 * of them pin down the third. Which two you happen to have depends on where
 * you are reading from: a quote gives you capacity, a monitoring alert gives
 * you a percentage, `df` gives you both and you want neither.
 *
 * Sizes are parsed and reported in whichever convention you wrote them in, so
 * a question asked in TiB is answered in TiB.
 */

export type DiskSpaceOptions = {
  /** Total size, e.g. "100TB". */
  capacity?: string;
  /** Space in use, e.g. "40TB". */
  used?: string;
  /** Percentage used, e.g. "70" or "70%". */
  percent?: string;
};

function parsePercent(input: string): number {
  const match = /^\s*(\d+(?:\.\d+)?)\s*%?\s*$/.exec(input);
  if (!match) {
    throw new ToolInputError(`percent must be a number like 70 or 70%, got "${input}"`);
  }

  const value = Number(match[1]);
  if (value > 100) {
    throw new ToolInputError("percent must be between 0 and 100 — more than full is not a thing");
  }
  return value;
}

/** Two decimal places at most, and no trailing zeros to read past. */
function formatPercent(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}

export function calculateDiskSpace(options: DiskSpaceOptions): ToolResult {
  const raw = {
    capacity: options.capacity?.trim() || undefined,
    used: options.used?.trim() || undefined,
    percent: options.percent?.trim() || undefined,
  };

  const given = Object.values(raw).filter((value) => value !== undefined);
  if (given.length < 2) {
    throw new ToolInputError(
      "give two of capacity, used and percent — the third is what you get back",
    );
  }
  if (given.length > 2) {
    throw new ToolInputError(
      "give only two of capacity, used and percent — all three can disagree",
    );
  }

  const capacity = raw.capacity ? parseSize(raw.capacity, "capacity") : undefined;
  const used = raw.used ? parseSize(raw.used, "used") : undefined;
  const percent = raw.percent ? parsePercent(raw.percent) : undefined;

  // Report in the convention that was asked in. Either input can carry it;
  // if both do and they disagree, the capacity is the one people quote.
  const binary = capacity?.binary ?? used?.binary ?? false;

  let capacityBytes: number;
  let usedBytes: number;

  if (capacity && used) {
    capacityBytes = capacity.bytes;
    usedBytes = used.bytes;
  } else if (capacity && percent !== undefined) {
    capacityBytes = capacity.bytes;
    usedBytes = (capacity.bytes * percent) / 100;
  } else if (used && percent !== undefined) {
    if (percent === 0) {
      throw new ToolInputError(
        "percent must be above zero to work a capacity out from it — nothing used tells you nothing about the size",
      );
    }
    usedBytes = used.bytes;
    capacityBytes = used.bytes / (percent / 100);
  } else {
    // Unreachable: two of three are set, and every pair is handled above.
    throw new ToolInputError("give two of capacity, used and percent");
  }

  if (capacityBytes <= 0) {
    throw new ToolInputError("capacity must be greater than zero");
  }
  if (usedBytes > capacityBytes) {
    throw new ToolInputError(
      `used (${humanSize(usedBytes, binary)}) is larger than capacity (${humanSize(capacityBytes, binary)})`,
    );
  }

  const freeBytes = capacityBytes - usedBytes;
  const usedPercent = (usedBytes / capacityBytes) * 100;

  return {
    kind: "fields",
    fields: [
      { label: "Capacity", value: humanSize(capacityBytes, binary) },
      { label: "Used", value: humanSize(usedBytes, binary) },
      { label: "Free", value: humanSize(freeBytes, binary) },
      { label: "Percent used", value: formatPercent(usedPercent) },
      { label: "Percent free", value: formatPercent(100 - usedPercent) },
    ],
  };
}
