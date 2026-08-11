import { ToolInputError, type ToolResult } from "../result";
import { toSymbolic } from "./permissions";

/**
 * umask, in both directions.
 *
 * The confusion umask causes is that it is a mask of bits to *remove*, applied
 * to a base that differs by type: 666 for files and 777 for directories. That
 * is why umask 022 gives 644 files but 755 directories, and why files never
 * come out executable no matter what the umask is — the base has no execute
 * bits to keep.
 */

const FILE_BASE = 0o666;
const DIRECTORY_BASE = 0o777;

function parseOctal(input: string, what: string): number {
  const trimmed = input.trim();
  if (!/^[0-7]{1,4}$/.test(trimmed)) {
    throw new ToolInputError(`${what} must be 1 to 4 octal digits, got "${input}"`);
  }
  return Number.parseInt(trimmed, 8);
}

const octal = (value: number) => (value & 0o7777).toString(8).padStart(3, "0");

export type UmaskOptions = {
  /** The mask itself, e.g. "022". */
  umask?: string;
  /** A wanted file mode, to work out which umask produces it. */
  file?: string;
  /** A wanted directory mode, to work out which umask produces it. */
  directory?: string;
};

export function calculateUmask(options: UmaskOptions): ToolResult {
  const given = [options.umask, options.file, options.directory].filter(Boolean);
  if (given.length === 0) {
    throw new ToolInputError("give umask, file or directory, e.g. ?umask=022");
  }
  if (given.length > 1) {
    throw new ToolInputError("give only one of umask, file or directory");
  }

  let mask: number;
  let derivedFrom: string | null = null;
  let ambiguous: string | null = null;

  if (options.umask !== undefined) {
    mask = parseOctal(options.umask, "umask");
  } else if (options.file !== undefined) {
    const wanted = parseOctal(options.file, "file mode");
    if (wanted & ~FILE_BASE & 0o777) {
      throw new ToolInputError(
        `${octal(wanted)} cannot come from a umask — files start at 666, so no umask grants execute`,
      );
    }
    mask = FILE_BASE & ~wanted & 0o777;
    derivedFrom = `the umask that produces files of ${octal(wanted)}`;
    // Base 666 has no execute bits, so a file mode cannot tell you whether the
    // umask masked execute. 026 and 027 both give 640 files — but 751 and 750
    // directories. Deriving from a directory mode is unambiguous.
    const widest = mask | 0o111;
    ambiguous =
      `The three execute bits are unconstrained, so eight umasks give files of ${octal(wanted)} — ` +
      `from ${octal(mask)} (directories ${octal(DIRECTORY_BASE & ~mask & 0o777)}) ` +
      `to ${octal(widest)} (directories ${octal(DIRECTORY_BASE & ~widest & 0o777)}). ` +
      `${octal(mask)} is shown. Derive from a directory mode to pin it down.`;
  } else {
    const wanted = parseOctal(options.directory!, "directory mode");
    mask = DIRECTORY_BASE & ~wanted & 0o777;
    derivedFrom = `the umask that produces directories of ${octal(wanted)}`;
  }

  const fileMode = FILE_BASE & ~mask & 0o777;
  const directoryMode = DIRECTORY_BASE & ~mask & 0o777;

  const fields = [
    { label: "umask", value: octal(mask) },
    { label: "Files", value: `${octal(fileMode)}  ${toSymbolic(fileMode)}` },
    { label: "Directories", value: `${octal(directoryMode)}  ${toSymbolic(directoryMode)}` },
    { label: "Masks out", value: toSymbolic(mask & 0o777) },
    { label: "Shell", value: `umask ${octal(mask)}` },
  ];

  if (derivedFrom) fields.splice(1, 0, { label: "Derived as", value: derivedFrom });
  if (ambiguous) fields.push({ label: "Not unique", value: ambiguous });

  // The single most common surprise, stated rather than left to be discovered.
  fields.push({
    label: "Note",
    value:
      "Files start from 666 and directories from 777, so a new file is never executable however permissive the umask.",
  });

  return { kind: "fields", fields };
}
