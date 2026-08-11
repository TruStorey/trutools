import { ToolInputError, type ToolResult } from "../result";

/**
 * Durations, in every form a config file is likely to want.
 *
 * systemd, Go, Kubernetes, ISO 8601 and plain seconds all disagree about how
 * to write "an hour and a half", and moving between them is the sort of thing
 * that gets fumbled at 2am.
 */

/** Multipliers in seconds. Order matters: longer aliases must be tried first. */
const UNITS: [string, number][] = [
  ["years", 31_557_600], // Julian year, which is what systemd uses
  ["year", 31_557_600],
  ["y", 31_557_600],
  ["months", 2_629_800],
  ["month", 2_629_800],
  ["M", 2_629_800],
  ["weeks", 604_800],
  ["week", 604_800],
  ["w", 604_800],
  ["days", 86_400],
  ["day", 86_400],
  ["d", 86_400],
  ["hours", 3600],
  ["hour", 3600],
  ["hr", 3600],
  ["h", 3600],
  ["minutes", 60],
  ["minute", 60],
  ["mins", 60],
  ["min", 60],
  ["m", 60],
  ["seconds", 1],
  ["second", 1],
  ["secs", 1],
  ["sec", 1],
  ["s", 1],
  ["milliseconds", 0.001],
  ["millisecond", 0.001],
  ["msec", 0.001],
  ["ms", 0.001],
  ["microseconds", 0.000001],
  ["usec", 0.000001],
  ["us", 0.000001],
];

/**
 * Parses "1h30m", "2h 30min", "90s", "1.5h" or a bare number of seconds.
 *
 * Case matters for exactly one pair: "M" is months and "m" is minutes, the
 * same convention systemd uses. Everything else is case-insensitive.
 */
export function parseDuration(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) throw new ToolInputError("a duration is required, e.g. 90s or 1h30m");

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (seconds < 0) throw new ToolInputError("duration cannot be negative");
    return seconds;
  }

  // ISO 8601: PT1H30M, P1DT2H
  const iso = /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
    trimmed,
  );
  if (iso && trimmed.length > 1) {
    const [, y, mo, w, d, h, mi, s] = iso.map((value) => (value ? Number(value) : 0));
    return (
      y * 31_557_600 + mo * 2_629_800 + w * 604_800 + d * 86_400 + h * 3600 + mi * 60 + s
    );
  }

  let total = 0;
  let matched = false;
  let rest = trimmed.replace(/,/g, " ");

  while (rest.trim()) {
    const part = /^\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/.exec(rest);
    if (!part) break;

    const amount = Number(part[1]);
    const rawUnit = part[2];

    const unit = UNITS.find(([name]) =>
      name === "M" || name === "m"
        ? name === rawUnit
        : name.toLowerCase() === rawUnit.toLowerCase(),
    );

    if (!unit) throw new ToolInputError(`unknown unit "${rawUnit}"`);

    total += amount * unit[1];
    matched = true;
    rest = rest.slice(part[0].length);
  }

  if (!matched || rest.trim()) {
    throw new ToolInputError(`cannot parse "${input}" — try 90s, 1h30m or PT1H30M`);
  }

  return total;
}

/** "1h 1m 1s" — the compact form, largest unit first, zeroes dropped. */
export function humanise(seconds: number): string {
  if (seconds === 0) return "0s";

  const parts: string[] = [];
  let left = seconds;

  for (const [unit, size] of [
    ["d", 86_400],
    ["h", 3600],
    ["m", 60],
    ["s", 1],
  ] as [string, number][]) {
    const amount = Math.floor(left / size);
    if (amount > 0) {
      parts.push(`${amount}${unit}`);
      left -= amount * size;
    }
  }

  if (left > 0) {
    const ms = Math.round(left * 1000);
    if (ms > 0) parts.push(`${ms}ms`);
  }

  return parts.join(" ");
}

function toIso(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Number((seconds % 60).toFixed(6));

  const date = days ? `${days}D` : "";
  const time = [hours ? `${hours}H` : "", minutes ? `${minutes}M` : "", rest ? `${rest}S` : ""].join("");

  if (!date && !time) return "PT0S";
  return `P${date}${time ? `T${time}` : ""}`;
}

/** systemd writes minutes as "min" so that "m" is unambiguous against months. */
function toSystemd(seconds: number): string {
  return humanise(seconds).replace(/(\d+)m\b/, "$1min");
}

function toClock(seconds: number): string {
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function convertDuration(input: string): ToolResult {
  const seconds = parseDuration(input);

  return {
    kind: "fields",
    fields: [
      { label: "Seconds", value: Number(seconds.toFixed(6)).toLocaleString("en-US") },
      { label: "Milliseconds", value: Math.round(seconds * 1000).toLocaleString("en-US") },
      { label: "Human", value: humanise(seconds) },
      { label: "systemd", value: toSystemd(seconds) },
      { label: "ISO 8601", value: toIso(seconds) },
      { label: "Clock", value: toClock(seconds) },
      { label: "Minutes", value: Number((seconds / 60).toFixed(4)).toLocaleString("en-US") },
      { label: "Hours", value: Number((seconds / 3600).toFixed(4)).toLocaleString("en-US") },
      { label: "Days", value: Number((seconds / 86_400).toFixed(4)).toLocaleString("en-US") },
    ],
  };
}
