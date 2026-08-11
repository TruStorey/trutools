import { ToolInputError, type ToolResult } from "../result";

/**
 * Unix file modes, both directions.
 *
 * The special bits are where these calculators usually go wrong. setuid,
 * setgid and sticky each *replace* the corresponding execute character rather
 * than adding one, and the replacement is capitalised when the execute bit is
 * clear — so 4755 is rwsr-xr-x but 4644 is rwSr--r--. The capital form means
 * "special bit set, execute not", which is almost always a mistake worth
 * seeing.
 */

const CLASSES = ["Owner", "Group", "Other"] as const;

export type PermissionOptions = {
  /** Octal, 3 or 4 digits. */
  mode?: string;
  /** Symbolic, 9 characters, optionally with a leading file-type character. */
  symbolic?: string;
};

function parseOctal(input: string): number {
  const trimmed = input.trim();
  if (!/^[0-7]{3,4}$/.test(trimmed)) {
    throw new ToolInputError(
      `"${input}" is not a valid octal mode — expected 3 or 4 digits, each 0-7, e.g. 755 or 4755`,
    );
  }
  return Number.parseInt(trimmed, 8);
}

function parseSymbolic(input: string): number {
  // Accept "-rwxr-xr-x" from ls as well as a bare "rwxr-xr-x".
  const trimmed = input.trim();
  const body = trimmed.length === 10 ? trimmed.slice(1) : trimmed;

  if (body.length !== 9) {
    throw new ToolInputError(
      `"${input}" is not a valid symbolic mode — expected 9 characters, e.g. rwxr-xr-x`,
    );
  }

  let value = 0;
  let special = 0;

  for (let group = 0; group < 3; group += 1) {
    const [read, write, execute] = [
      body[group * 3],
      body[group * 3 + 1],
      body[group * 3 + 2],
    ];

    if (read !== "r" && read !== "-") throw new ToolInputError(`expected r or - at position ${group * 3 + 1}`);
    if (write !== "w" && write !== "-") throw new ToolInputError(`expected w or - at position ${group * 3 + 2}`);

    if (read === "r") value |= 0o400 >> (group * 3);
    if (write === "w") value |= 0o200 >> (group * 3);

    // The execute slot carries the special bit as well as execute itself.
    const specialBit = group === 0 ? 0o4000 : group === 1 ? 0o2000 : 0o1000;
    const lowerSpecial = group === 2 ? "t" : "s";
    const upperSpecial = group === 2 ? "T" : "S";

    switch (execute) {
      case "x":
        value |= 0o100 >> (group * 3);
        break;
      case "-":
        break;
      case lowerSpecial:
        value |= 0o100 >> (group * 3);
        special |= specialBit;
        break;
      case upperSpecial:
        special |= specialBit;
        break;
      default:
        throw new ToolInputError(
          `expected x, -, ${lowerSpecial} or ${upperSpecial} at position ${group * 3 + 3}`,
        );
    }
  }

  return value | special;
}

export function toSymbolic(mode: number): string {
  let out = "";

  for (let group = 0; group < 3; group += 1) {
    const shift = 6 - group * 3;
    const bits = (mode >> shift) & 0o7;
    const specialBit = group === 0 ? 0o4000 : group === 1 ? 0o2000 : 0o1000;
    const hasSpecial = (mode & specialBit) !== 0;
    const canExecute = (bits & 0o1) !== 0;

    out += bits & 0o4 ? "r" : "-";
    out += bits & 0o2 ? "w" : "-";

    if (!hasSpecial) {
      out += canExecute ? "x" : "-";
    } else {
      const letter = group === 2 ? "t" : "s";
      out += canExecute ? letter : letter.toUpperCase();
    }
  }

  return out;
}

export function toOctal(mode: number): string {
  return (mode & 0o7777).toString(8).padStart(4, "0");
}

function describeClass(bits: number): string {
  const parts = [
    bits & 0o4 ? "read" : null,
    bits & 0o2 ? "write" : null,
    bits & 0o1 ? "execute" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "no access";
}

/** "755" -> "rwxr-xr-x". Throws ToolInputError on anything malformed. */
export function octalToSymbolic(input: string): string {
  return toSymbolic(parseOctal(input));
}

/** "rwxr-xr-x" -> "0755". Throws ToolInputError on anything malformed. */
export function symbolicToOctal(input: string): string {
  return toOctal(parseSymbolic(input));
}

export function calculatePermissions(options: PermissionOptions): ToolResult {
  if (options.mode && options.symbolic) {
    throw new ToolInputError("give either mode or symbolic, not both");
  }

  const value = options.mode
    ? parseOctal(options.mode)
    : options.symbolic
      ? parseSymbolic(options.symbolic)
      : (() => {
          throw new ToolInputError("mode or symbolic is required, e.g. ?mode=755");
        })();

  const octal = toOctal(value);
  const symbolic = toSymbolic(value);

  const fields = [
    { label: "Octal", value: octal },
    { label: "Octal (short)", value: octal.slice(1) },
    { label: "Symbolic", value: symbolic },
    { label: "ls -l", value: `-${symbolic}` },
  ];

  CLASSES.forEach((name, group) => {
    const bits = (value >> (6 - group * 3)) & 0o7;
    fields.push({ label: name, value: `${bits} — ${describeClass(bits)}` });
  });

  const special = [
    value & 0o4000 ? "setuid" : null,
    value & 0o2000 ? "setgid" : null,
    value & 0o1000 ? "sticky" : null,
  ].filter(Boolean);

  fields.push({ label: "Special bits", value: special.length ? special.join(", ") : "none" });

  // A capital letter in the symbolic form means the special bit is set without
  // the matching execute bit, which is nearly always unintended.
  if (/[ST]/.test(symbolic)) {
    fields.push({
      label: "Warning",
      value:
        "A capital S or T means a special bit is set but the matching execute bit is not — usually a mistake.",
    });
  }

  fields.push({ label: "chmod", value: `chmod ${octal.slice(1)} <file>` });

  return { kind: "fields", fields };
}
