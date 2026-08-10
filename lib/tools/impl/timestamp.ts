import { ToolInputError, type ToolResult } from "../result";

export type TimestampOptions = {
  /** Epoch seconds, epoch millis, an ISO 8601 string, or "now". */
  value: string;
  /** IANA timezone for the local rendering. */
  timezone: string;
};

export const TIMESTAMP_DEFAULTS: TimestampOptions = {
  value: "",
  timezone: "UTC",
};

/**
 * Digits alone are ambiguous: 1700000000 is seconds, 1700000000000 is millis.
 * Ten digits or fewer is treated as seconds, which stays correct until the
 * year 2286.
 */
function parseValue(raw: string): Date {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "now") return new Date();

  if (/^-?\d+$/.test(trimmed)) {
    const digits = trimmed.replace("-", "").length;
    const numeric = Number(trimmed);
    const date = new Date(digits <= 10 ? numeric * 1000 : numeric);
    if (Number.isNaN(date.getTime())) throw new ToolInputError(`cannot parse "${raw}"`);
    return date;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new ToolInputError(
      `cannot parse "${raw}" — expected epoch seconds, epoch millis, or an ISO 8601 date`,
    );
  }
  return parsed;
}

function formatInZone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "long",
    }).format(date);
  } catch {
    throw new ToolInputError(`unknown timezone "${timezone}"`);
  }
}

/** "3 hours ago" / "in 2 days", using the platform's own relative formatter. */
function relative(date: Date): string {
  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(deltaSeconds) >= seconds) {
      return formatter.format(Math.round(deltaSeconds / seconds), unit);
    }
  }
  return "now";
}

export function convertTimestamp(options: TimestampOptions): ToolResult {
  const date = parseValue(options.value);
  const timezone = options.timezone.trim() || "UTC";

  return {
    kind: "fields",
    fields: [
      { label: "Epoch (seconds)", value: String(Math.floor(date.getTime() / 1000)) },
      { label: "Epoch (millis)", value: String(date.getTime()) },
      { label: "ISO 8601 (UTC)", value: date.toISOString() },
      { label: "RFC 2822", value: date.toUTCString() },
      { label: timezone, value: formatInZone(date, timezone) },
      { label: "Relative", value: relative(date) },
    ],
  };
}

/** Offered in the timezone picker; anything else can still be typed. */
export const COMMON_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];
