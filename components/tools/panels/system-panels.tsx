"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Field, Segmented, TextAreaControl, TextControl, Toggle } from "@/components/tools/controls";
import { ToolOutput } from "@/components/tools/tool-output";
import { useToolRun } from "@/components/tools/use-tool-run";
import { Button } from "@/components/ui/button";
import { convertCase } from "@/lib/tools/impl/case-convert";
import { explainCron } from "@/lib/tools/impl/cron";
import { generateLorem, LOREM_UNITS, type LoremUnit } from "@/lib/tools/impl/lorem";
import {
  calculatePermissions,
  octalToSymbolic,
  symbolicToOctal,
} from "@/lib/tools/impl/permissions";
import { lintUnitFile } from "@/lib/tools/impl/systemd";

export function CasePanel() {
  const [input, setInput] = useState("");
  const { result, error, run, reset } = useToolRun();

  useEffect(() => {
    if (!input.trim()) {
      reset();
      return;
    }
    run(() => convertCase({ input }));
  }, [input, run, reset]);

  return (
    <div className="space-y-4">
      <Field label="Text" hint="any case, or a sentence">
        <TextControl
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="parseHTTPResponse quickly"
        />
      </Field>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function LoremPanel() {
  const [unit, setUnit] = useState<LoremUnit>("paragraphs");
  const [count, setCount] = useState(3);
  const [classic, setClassic] = useState(true);
  const { result, error, run } = useToolRun();

  useEffect(() => {
    run(() => generateLorem({ unit, count, classic }));
  }, [unit, count, classic, run]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Segmented
          label="Unit"
          value={unit}
          onChange={setUnit}
          options={LOREM_UNITS.map((id) => ({ value: id, label: id }))}
        />
        <Field label="How many" className="w-28">
          <TextControl
            type="number"
            min={1}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </Field>
        <div className="pb-1">
          <Toggle label="Classic opening" checked={classic} onChange={setClassic} />
        </div>
      </div>

      <Button
        size="sm"
        variant="secondary"
        onClick={() => run(() => generateLorem({ unit, count, classic }))}
      >
        <RefreshCw />
        Regenerate
      </Button>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function PermissionsPanel() {
  const [mode, setMode] = useState("755");
  const [symbolic, setSymbolic] = useState("rwxr-xr-x");
  const { result, error, run } = useToolRun();

  // Populate on open. Editing is handled in the change handlers below, so the
  // two boxes stay in step without an effect that watches its own output.
  useEffect(() => {
    run(() => calculatePermissions({ mode: "755" }));
  }, [run]);

  function editOctal(next: string) {
    setMode(next);
    // Partial input is expected while typing, so a failure here just means the
    // other box waits rather than showing something wrong.
    try {
      setSymbolic(octalToSymbolic(next));
    } catch {
      /* keep the previous symbolic form */
    }
    run(() => calculatePermissions({ mode: next }));
  }

  function editSymbolic(next: string) {
    setSymbolic(next);
    try {
      setMode(symbolicToOctal(next).slice(1));
    } catch {
      /* keep the previous octal form */
    }
    run(() => calculatePermissions({ symbolic: next }));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Octal" hint="3 or 4 digits">
          <TextControl
            value={mode}
            onChange={(event) => editOctal(event.target.value)}
            placeholder="4755"
          />
        </Field>
        <Field label="Symbolic">
          <TextControl
            value={symbolic}
            onChange={(event) => editSymbolic(event.target.value)}
            placeholder="rwxr-xr-x"
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["755", "644", "600", "777", "4755", "2775", "1777"].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => editOctal(preset)}
            className="rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-[0.7rem] text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground dark:bg-black/20 dark:hover:bg-black/30"
          >
            {preset}
          </button>
        ))}
      </div>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function SystemdPanel() {
  const [input, setInput] = useState("");
  const { result, error, run, reset } = useToolRun();

  useEffect(() => {
    if (!input.trim()) {
      reset();
      return;
    }
    run(() => lintUnitFile(input));
  }, [input, run, reset]);

  return (
    <div className="space-y-4">
      <Field label="Unit file">
        <TextAreaControl
          className="min-h-48"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={"[Unit]\nDescription=Example\n\n[Service]\nExecStart=/usr/bin/myapp\n\n[Install]\nWantedBy=multi-user.target"}
        />
      </Field>

      <p className="text-xs text-muted-foreground">
        Structure and common mistakes only. This is not{" "}
        <code className="font-mono">systemd-analyze verify</code>, which needs systemd
        itself and is not in the container this runs in.
      </p>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function CronPanel() {
  const [expression, setExpression] = useState("0 3 * * 1");
  const [count, setCount] = useState(5);
  // The viewer's own zone, since a schedule is only meaningful in one.
  const [timeZone, setTimeZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const { result, error, run, reset } = useToolRun();

  useEffect(() => {
    if (!expression.trim()) {
      reset();
      return;
    }
    run(() => explainCron({ expression, count, timeZone }));
  }, [expression, count, timeZone, run, reset]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label="Expression" hint="5 fields, or a macro like @daily">
          <TextControl
            value={expression}
            onChange={(event) => setExpression(event.target.value)}
            placeholder="0 3 * * 1"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Field label="Next runs">
          <TextControl
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </Field>
      </div>

      <Field label="Timezone">
        <TextControl value={timeZone} onChange={(event) => setTimeZone(event.target.value)} />
      </Field>

      <div className="flex flex-wrap gap-1.5">
        {["0 3 * * 1", "*/15 * * * *", "@daily", "0 0 1 * *", "0 0 13 * 5", "0 9-17 * * 1-5"].map(
          (preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setExpression(preset)}
              className="rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-[0.7rem] text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground dark:bg-black/20 dark:hover:bg-black/30"
            >
              {preset}
            </button>
          ),
        )}
      </div>

      <ToolOutput result={result} error={error} />
    </div>
  );
}
