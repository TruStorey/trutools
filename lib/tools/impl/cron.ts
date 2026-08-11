import { ToolInputError, type ToolResult } from "../result";

/**
 * Cron expression explainer.
 *
 * The trap this exists for: when *both* day-of-month and day-of-week are
 * restricted, cron ORs them rather than ANDing them. `0 0 13 * 5` fires on the
 * 13th **and** on every Friday — not on Friday the 13th. Vixie cron, cronie and
 * the POSIX spec all agree on this and it still catches people out, so the
 * description says which rule is in play.
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MONTH_ALIASES: Record<string, number> = Object.fromEntries(
  MONTH_NAMES.map((name, index) => [name.slice(0, 3).toLowerCase(), index + 1]),
);

const DAY_ALIASES: Record<string, number> = Object.fromEntries(
  DAY_NAMES.map((name, index) => [name.slice(0, 3).toLowerCase(), index]),
);

/** The @-shorthands, expanded to their five-field equivalents. */
const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

type FieldSpec = {
  name: string;
  min: number;
  max: number;
  aliases?: Record<string, number>;
};

const FIELDS: FieldSpec[] = [
  { name: "minute", min: 0, max: 59 },
  { name: "hour", min: 0, max: 23 },
  { name: "day of month", min: 1, max: 31 },
  { name: "month", min: 1, max: 12, aliases: MONTH_ALIASES },
  { name: "day of week", min: 0, max: 7, aliases: DAY_ALIASES },
];

export type CronField = {
  /** Every value this field matches. */
  values: number[];
  /** True when the field is `*`, which is what decides the DOM/DOW rule. */
  unrestricted: boolean;
  raw: string;
};

function parseField(raw: string, spec: FieldSpec): CronField {
  const values = new Set<number>();
  let unrestricted = false;

  for (const part of raw.split(",")) {
    if (!part) throw new ToolInputError(`empty ${spec.name} entry in "${raw}"`);

    const [rangePart, stepPart] = part.split("/");
    if (stepPart !== undefined && !/^\d+$/.test(stepPart)) {
      throw new ToolInputError(`step in ${spec.name} must be a number, got "${stepPart}"`);
    }
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (step < 1) throw new ToolInputError(`step in ${spec.name} must be at least 1`);

    const resolve = (token: string): number => {
      const alias = spec.aliases?.[token.toLowerCase()];
      if (alias !== undefined) return alias;
      if (!/^\d+$/.test(token)) {
        throw new ToolInputError(`"${token}" is not valid in the ${spec.name} field`);
      }
      const value = Number(token);
      if (value < spec.min || value > spec.max) {
        throw new ToolInputError(
          `${spec.name} must be between ${spec.min} and ${spec.max}, got ${value}`,
        );
      }
      return value;
    };

    let from: number;
    let to: number;

    if (rangePart === "*") {
      from = spec.min;
      to = spec.max;
      if (step === 1) unrestricted = true;
    } else if (rangePart.includes("-")) {
      const [start, end] = rangePart.split("-");
      from = resolve(start);
      to = resolve(end);
      if (from > to) throw new ToolInputError(`${spec.name} range ${rangePart} runs backwards`);
    } else {
      from = resolve(rangePart);
      to = stepPart === undefined ? from : spec.max;
    }

    for (let value = from; value <= to; value += step) values.add(value);
  }

  // Sunday is both 0 and 7; normalise so matching only has to check one.
  if (spec.name === "day of week" && values.has(7)) {
    values.delete(7);
    values.add(0);
  }

  return { values: [...values].sort((a, b) => a - b), unrestricted, raw };
}

export type ParsedCron = {
  fields: CronField[];
  expression: string;
  /** True when both day fields are restricted, so cron ORs them. */
  dayOr: boolean;
};

export function parseCron(input: string): ParsedCron {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) throw new ToolInputError("a cron expression is required, e.g. 0 3 * * 1");

  if (trimmed === "@reboot") {
    throw new ToolInputError("@reboot has no schedule — it runs once when the machine starts");
  }

  const expression = MACROS[trimmed] ?? trimmed;
  const parts = expression.split(/\s+/);

  if (parts.length === 6) {
    throw new ToolInputError(
      "this looks like a 6-field expression (with seconds). Standard cron takes 5 fields",
    );
  }
  if (parts.length !== 5) {
    throw new ToolInputError(`expected 5 fields, got ${parts.length}`);
  }

  const fields = parts.map((part, index) => parseField(part, FIELDS[index]));

  return {
    fields,
    expression,
    dayOr: !fields[2].unrestricted && !fields[4].unrestricted,
  };
}

// ------------------------------------------------------------- description

function listValues(values: number[], render: (value: number) => string): string {
  if (values.length === 1) return render(values[0]);
  if (values.length === 2) return `${render(values[0])} and ${render(values[1])}`;
  return `${values.slice(0, -1).map(render).join(", ")} and ${render(values[values.length - 1])}`;
}

/** Whether the values form an evenly spaced run covering the whole field. */
function asStep(field: CronField, spec: FieldSpec): number | null {
  if (field.values.length < 3) return null;
  const step = field.values[1] - field.values[0];
  if (step < 2) return null;
  for (let i = 1; i < field.values.length; i += 1) {
    if (field.values[i] - field.values[i - 1] !== step) return null;
  }
  if (field.values[0] !== spec.min) return null;
  if (field.values[field.values.length - 1] + step <= spec.max) return null;
  return step;
}

function describeTime(minute: CronField, hour: CronField): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  if (minute.unrestricted && hour.unrestricted) return "Every minute";
  if (minute.unrestricted) {
    return `Every minute during ${listValues(hour.values, (h) => `${pad(h)}:00`)}`;
  }

  const minuteStep = asStep(minute, FIELDS[0]);
  if (minuteStep) {
    const window = hour.unrestricted
      ? ""
      : ` during ${listValues(hour.values, (h) => `${pad(h)}:00`)}`;
    return `Every ${minuteStep} minutes${window}`;
  }

  if (hour.unrestricted) {
    return `At ${listValues(minute.values, (m) => `${pad(m)} minutes past the hour`)}`;
  }

  const hourStep = asStep(hour, FIELDS[1]);
  if (hourStep && minute.values.length === 1) {
    return `Every ${hourStep} hours, at ${pad(minute.values[0])} minutes past`;
  }

  const times: string[] = [];
  for (const h of hour.values) for (const m of minute.values) times.push(`${pad(h)}:${pad(m)}`);
  return `At ${listValues(times.map((_, i) => i), (i) => times[i])}`;
}

export function describeCron(parsed: ParsedCron): string {
  const [minute, hour, dom, month, dow] = parsed.fields;

  const parts = [describeTime(minute, hour)];

  const domText = dom.unrestricted
    ? null
    : `on the ${listValues(dom.values, (d) => `${d}${ordinal(d)}`)}`;
  const dowText = dow.unrestricted
    ? null
    : `on ${listValues(dow.values, (d) => DAY_NAMES[d])}`;

  if (domText && dowText) {
    // The OR is the whole point — spell it out rather than joining with "and".
    parts.push(`${domText} **or** ${dowText} (cron ORs these when both are set)`);
  } else if (domText) {
    parts.push(domText);
  } else if (dowText) {
    parts.push(dowText);
  }

  if (!month.unrestricted) {
    parts.push(`in ${listValues(month.values, (m) => MONTH_NAMES[m - 1])}`);
  }

  return `${parts.join(" ")}.`;
}

function ordinal(value: number): string {
  if (value % 100 >= 11 && value % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][value % 10] ?? "th";
}

// ---------------------------------------------------------------- next runs

/** Matches the day fields, applying the OR rule when both are restricted. */
function dayMatches(parsed: ParsedCron, date: Date, timeZone: string): boolean {
  const parts = zonedParts(date, timeZone);
  const [, , dom, month, dow] = parsed.fields;

  if (!month.values.includes(parts.month)) return false;

  const domHit = dom.values.includes(parts.day);
  const dowHit = dow.values.includes(parts.weekday);

  if (parsed.dayOr) return domHit || dowHit;
  if (!dom.unrestricted) return domHit;
  if (!dow.unrestricted) return dowHit;
  return true;
}

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

/** Reads the wall-clock fields a schedule is expressed in, in the given zone. */
function zonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) parts[part.type] = part.value;

  const weekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // "24" appears at midnight in some locales; normalise it to 0.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: weekdays.indexOf(parts.weekday.slice(0, 3).toLowerCase()),
  };
}

const MINUTE_MS = 60_000;
const MAX_DAYS_AHEAD = 5 * 366;

export function nextRuns(
  parsed: ParsedCron,
  count: number,
  timeZone: string,
  from: Date = new Date(),
): Date[] {
  const [minute, hour] = parsed.fields;
  const runs: Date[] = [];

  // Start at the next whole minute; cron has no sub-minute resolution.
  const cursor = new Date(Math.floor(from.getTime() / MINUTE_MS) * MINUTE_MS + MINUTE_MS);
  const limit = new Date(cursor.getTime() + MAX_DAYS_AHEAD * 86_400_000);

  // Walk minute by minute but skip whole days that cannot match, which is what
  // keeps a rare schedule like "0 0 29 2 *" from costing millions of steps.
  while (cursor < limit && runs.length < count) {
    if (!dayMatches(parsed, cursor, timeZone)) {
      const parts = zonedParts(cursor, timeZone);
      // Jump to just before the next midnight in the target zone.
      cursor.setTime(cursor.getTime() + (24 * 60 - (parts.hour * 60 + parts.minute)) * MINUTE_MS);
      continue;
    }

    const parts = zonedParts(cursor, timeZone);
    if (hour.values.includes(parts.hour) && minute.values.includes(parts.minute)) {
      runs.push(new Date(cursor));
    }

    cursor.setTime(cursor.getTime() + MINUTE_MS);
  }

  return runs;
}

export type CronOptions = {
  expression: string;
  count: number;
  timeZone: string;
};

export function explainCron(options: CronOptions): ToolResult {
  const parsed = parseCron(options.expression);

  if (options.count < 1 || options.count > 50) {
    throw new ToolInputError("count must be between 1 and 50");
  }

  const timeZone = options.timeZone.trim() || "UTC";
  let runs: Date[];
  try {
    runs = nextRuns(parsed, options.count, timeZone);
  } catch {
    throw new ToolInputError(`unknown timezone "${timeZone}"`);
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  });

  const fields = [
    { label: "Expression", value: parsed.expression },
    { label: "Meaning", value: describeCron(parsed).replace(/\*\*/g, "") },
    { label: "Minute", value: parsed.fields[0].raw },
    { label: "Hour", value: parsed.fields[1].raw },
    { label: "Day of month", value: parsed.fields[2].raw },
    { label: "Month", value: parsed.fields[3].raw },
    { label: "Day of week", value: parsed.fields[4].raw },
  ];

  if (parsed.dayOr) {
    fields.push({
      label: "Warning",
      value:
        "Day of month and day of week are both set, so cron runs on either — not on days matching both.",
    });
  }

  fields.push({
    label: `Next ${runs.length} (${timeZone})`,
    value: runs.length ? runs.map((run) => formatter.format(run)).join("\n") : "no runs in the next 5 years",
  });

  return { kind: "fields", fields };
}
