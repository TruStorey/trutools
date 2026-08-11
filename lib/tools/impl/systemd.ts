import { ToolInputError, type ToolResult } from "../result";

/**
 * A systemd unit file linter.
 *
 * Deliberately not `systemd-analyze verify`: the runtime image is Alpine with
 * no systemd in it, and there is no honest way to run the real validator. This
 * checks structure and the mistakes that actually bite — unknown sections,
 * directives outside any section, a Service with no ExecStart — and says so
 * rather than implying a full validation happened.
 */

const SECTIONS = new Set([
  "Unit",
  "Install",
  "Service",
  "Socket",
  "Mount",
  "Automount",
  "Swap",
  "Path",
  "Timer",
  "Slice",
  "Scope",
]);

/** Directives that must sit in a particular section. */
const SECTION_OF: Record<string, string> = {
  ExecStart: "Service",
  ExecStop: "Service",
  ExecReload: "Service",
  ExecStartPre: "Service",
  ExecStartPost: "Service",
  Type: "Service",
  Restart: "Service",
  RestartSec: "Service",
  User: "Service",
  Group: "Service",
  WorkingDirectory: "Service",
  Environment: "Service",
  EnvironmentFile: "Service",
  RemainAfterExit: "Service",
  Description: "Unit",
  After: "Unit",
  Before: "Unit",
  Requires: "Unit",
  Wants: "Unit",
  Documentation: "Unit",
  ConditionPathExists: "Unit",
  WantedBy: "Install",
  RequiredBy: "Install",
  Alias: "Install",
  OnCalendar: "Timer",
  OnBootSec: "Timer",
  OnUnitActiveSec: "Timer",
  ListenStream: "Socket",
  ListenDatagram: "Socket",
};

const SERVICE_TYPES = new Set([
  "simple",
  "exec",
  "forking",
  "oneshot",
  "dbus",
  "notify",
  "notify-reload",
  "idle",
]);

const RESTART_VALUES = new Set([
  "no",
  "always",
  "on-success",
  "on-failure",
  "on-abnormal",
  "on-abort",
  "on-watchdog",
]);

type Finding = { line: number; severity: "error" | "warning"; message: string };

export function lintUnitFile(input: string): ToolResult {
  if (!input.trim()) throw new ToolInputError("nothing to check");

  const findings: Finding[] = [];
  const lines = input.split(/\r?\n/);

  let section = "";
  const seenSections = new Set<string>();

  // Keyed by section, not just by directive: ExecStart= inside a mistyped
  // [Servce] must not be counted as one of [Service]'s, or the line numbers
  // reported for duplicates point at the wrong line.
  const bySection = new Map<string, Map<string, { value: string; line: number }[]>>();
  const directivesIn = (name: string) => bySection.get(name) ?? new Map();

  lines.forEach((raw, index) => {
    const number = index + 1;
    const line = raw.trim();

    if (!line || line.startsWith("#") || line.startsWith(";")) return;

    const sectionMatch = /^\[(.+)\]$/.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1];
      if (seenSections.has(section)) {
        findings.push({ line: number, severity: "warning", message: `[${section}] appears more than once` });
      }
      seenSections.add(section);

      if (!SECTIONS.has(section) && !section.startsWith("X-")) {
        findings.push({
          line: number,
          severity: "error",
          message: `unknown section [${section}] — custom sections must start with X-`,
        });
      }
      return;
    }

    const equals = line.indexOf("=");
    if (equals < 1) {
      findings.push({
        line: number,
        severity: "error",
        message: `not a directive or section header: "${line.slice(0, 40)}"`,
      });
      return;
    }

    const key = line.slice(0, equals).trim();
    const value = line.slice(equals + 1).trim();

    if (!section) {
      findings.push({
        line: number,
        severity: "error",
        message: `${key}= appears before any [Section] header`,
      });
      return;
    }

    const expected = SECTION_OF[key];
    if (expected && expected !== section) {
      findings.push({
        line: number,
        severity: "error",
        message: `${key}= belongs in [${expected}], not [${section}]`,
      });
    }

    if (key === "Type" && value && !SERVICE_TYPES.has(value)) {
      findings.push({
        line: number,
        severity: "error",
        message: `Type=${value} is not a known service type`,
      });
    }

    if (key === "Restart" && value && !RESTART_VALUES.has(value)) {
      findings.push({
        line: number,
        severity: "error",
        message: `Restart=${value} is not a known value`,
      });
    }

    if (!value) {
      findings.push({
        line: number,
        severity: "warning",
        message: `${key}= is empty, which resets it rather than setting it`,
      });
    }

    if (!bySection.has(section)) bySection.set(section, new Map());
    const inSection = bySection.get(section)!;
    const existing = inSection.get(key) ?? [];
    existing.push({ value, line: number });
    inSection.set(key, existing);
  });

  // Whole-file checks.
  if (seenSections.size === 0) {
    findings.push({ line: 1, severity: "error", message: "no [Section] headers at all" });
  }

  if (!seenSections.has("Unit")) {
    findings.push({ line: 1, severity: "warning", message: "no [Unit] section — Description= is conventional" });
  } else if (!directivesIn("Unit").has("Description")) {
    findings.push({ line: 1, severity: "warning", message: "[Unit] has no Description=" });
  }

  if (seenSections.has("Service")) {
    const service = directivesIn("Service");
    const type = service.get("Type")?.[0]?.value ?? "simple";

    if (!service.has("ExecStart") && type !== "oneshot") {
      findings.push({
        line: 1,
        severity: "error",
        message: `[Service] with Type=${type} requires ExecStart=`,
      });
    }

    if (type === "oneshot" && (service.get("ExecStart")?.length ?? 0) === 0) {
      findings.push({
        line: 1,
        severity: "warning",
        message: "Type=oneshot with no ExecStart= does nothing",
      });
    }

    if ((service.get("ExecStart")?.length ?? 0) > 1 && type !== "oneshot") {
      findings.push({
        line: service.get("ExecStart")![1].line,
        severity: "error",
        message: `multiple ExecStart= is only allowed with Type=oneshot`,
      });
    }

    for (const entry of service.get("ExecStart") ?? []) {
      if (entry.value && !/^[-@+!]*\//.test(entry.value)) {
        findings.push({
          line: entry.line,
          severity: "error",
          message: "ExecStart= needs an absolute path",
        });
      }
    }
  }

  if (!seenSections.has("Install") && !seenSections.has("Timer")) {
    findings.push({
      line: 1,
      severity: "warning",
      message: "no [Install] section — the unit cannot be enabled, only started",
    });
  }

  findings.sort((a, b) => a.line - b.line || a.severity.localeCompare(b.severity));

  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warnings = findings.length - errors;

  const rows = findings.length
    ? findings.map((finding) => [String(finding.line), finding.severity, finding.message])
    : [["-", "ok", "No structural problems found."]];

  return {
    kind: "rows",
    columns: ["Line", "Severity", "Finding"],
    rows,
    note:
      `${errors} error(s), ${warnings} warning(s). ` +
      "Structure and common-mistake checks only — this is not systemd-analyze verify, " +
      "which needs systemd itself.",
  };
}
