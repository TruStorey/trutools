import { ToolInputError, type ToolResult } from "../result";
import { randomInt, randomString, shuffle } from "./random";

const SETS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!#$%&*+-=?@^_~",
} as const;

// Characters that are easy to confuse in a terminal or when read aloud.
const AMBIGUOUS = new Set("O0oIl1|`'\"");

export type PasswordOptions = {
  length: number;
  count: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
};

export const PASSWORD_DEFAULTS: PasswordOptions = {
  length: 24,
  count: 1,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

function buildAlphabets(options: PasswordOptions): string[] {
  const enabled: string[] = [];
  if (options.lowercase) enabled.push(SETS.lowercase);
  if (options.uppercase) enabled.push(SETS.uppercase);
  if (options.digits) enabled.push(SETS.digits);
  if (options.symbols) enabled.push(SETS.symbols);

  if (!options.excludeAmbiguous) return enabled;

  return enabled
    .map((set) =>
      [...set].filter((character) => !AMBIGUOUS.has(character)).join(""),
    )
    .filter((set) => set.length > 0);
}

export function generatePassword(options: PasswordOptions): ToolResult {
  if (options.length < 4 || options.length > 256) {
    throw new ToolInputError("length must be between 4 and 256");
  }
  if (options.count < 1 || options.count > 100) {
    throw new ToolInputError("count must be between 1 and 100");
  }

  const alphabets = buildAlphabets(options);
  if (alphabets.length === 0) {
    throw new ToolInputError("at least one character set must be enabled");
  }
  if (alphabets.length > options.length) {
    throw new ToolInputError(
      `length must be at least ${alphabets.length} to include one of every selected set`,
    );
  }

  const pool = alphabets.join("");
  const passwords: string[] = [];

  for (let i = 0; i < options.count; i += 1) {
    // Guarantee one character from each enabled set, then fill the rest from
    // the combined pool and shuffle. Without the guarantee, "include symbols"
    // is only a probability — a 12-char password would omit them ~1 time in 6.
    const required = alphabets.map((set) => set[randomInt(set.length)]);
    const rest = randomString(pool, options.length - required.length);
    passwords.push(shuffle([...required, ...rest]).join(""));
  }

  return { kind: "lines", lines: passwords };
}

/** log2(alphabet ^ length), the honest way to describe password strength. */
export function passwordEntropyBits(options: PasswordOptions): number {
  const pool = buildAlphabets(options).join("");
  if (pool.length === 0) return 0;
  return Math.round(options.length * Math.log2(pool.length));
}
