"use client";

import { Clock, Minimize2, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Field,
  Segmented,
  SelectControl,
  TextAreaControl,
  TextControl,
  Toggle,
} from "@/components/tools/controls";
import { ToolOutput } from "@/components/tools/tool-output";
import { useToolRun } from "@/components/tools/use-tool-run";
import { Button } from "@/components/ui/button";
import { convertDuration } from "@/lib/tools/impl/duration";
import { calculateSubnet } from "@/lib/tools/impl/subnet";
import { convertTimestamp, COMMON_TIMEZONES } from "@/lib/tools/impl/timestamp";
import { formatJson } from "@/lib/tools/impl/json-format";
import { transformText, TEXT_OPERATIONS, type TextOperation } from "@/lib/tools/impl/text";

export function SubnetPanel() {
  const [cidr, setCidr] = useState("10.0.0.0/22");
  const { result, error, run } = useToolRun();

  // Recalculate as you type. The maths is instant and there is no request
  // behind it, so debouncing would only add lag.
  useEffect(() => {
    if (!cidr.trim()) return;
    run(() => calculateSubnet(cidr));
  }, [cidr, run]);

  return (
    <div className="space-y-4">
      <Field label="CIDR block" hint="IPv4 or IPv6">
        <TextControl
          value={cidr}
          onChange={(event) => setCidr(event.target.value)}
          placeholder="10.0.0.0/22"
          autoComplete="off"
        />
      </Field>

      <div className="flex flex-wrap gap-1.5">
        {["10.0.0.0/22", "192.168.1.0/24", "172.16.0.0/12", "100.64.0.0/10", "2001:db8::/48"].map(
          (example) => (
            <button
              key={example}
              type="button"
              onClick={() => setCidr(example)}
              className="rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-[0.7rem] text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground dark:bg-black/20 dark:hover:bg-black/30"
            >
              {example}
            </button>
          ),
        )}
      </div>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function TimestampPanel() {
  const [value, setValue] = useState("");
  // Default to the viewer's own zone rather than making them hunt for it.
  // Lazy initialiser, not an effect — the panel only mounts after a click, so
  // there is no server render to mismatch against.
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const { result, error, run } = useToolRun();

  useEffect(() => {
    run(() => convertTimestamp({ value: value || "now", timezone }));
  }, [value, timezone, run]);

  const zones = COMMON_TIMEZONES.includes(timezone)
    ? COMMON_TIMEZONES
    : [timezone, ...COMMON_TIMEZONES];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Value" hint="epoch, ISO 8601, or blank for now">
          <TextControl
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="1754870400"
            autoComplete="off"
          />
        </Field>
        <Field label="Timezone">
          <SelectControl value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </SelectControl>
        </Field>
      </div>

      <Button size="sm" variant="secondary" onClick={() => setValue("")}>
        <Clock />
        Use now
      </Button>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function JsonPanel() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState(2);
  const [sort, setSort] = useState(false);
  const { result, error, run, reset } = useToolRun();

  function format(nextIndent = indent) {
    if (!input.trim()) {
      reset();
      return;
    }
    run(() => formatJson({ input, indent: nextIndent, sort }));
  }

  return (
    <div className="space-y-4">
      <Field label="JSON">
        <TextAreaControl
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={'{"name":"trutools","tags":["crypto","networking"]}'}
        />
      </Field>

      <div className="flex flex-wrap items-end gap-4">
        <Segmented
          label="Indent"
          value={indent}
          onChange={(next) => {
            setIndent(next);
            format(next);
          }}
          options={[
            { value: 2, label: "2" },
            { value: 4, label: "4" },
            { value: 0, label: "minify" },
          ]}
        />
        <div className="pb-1">
          <Toggle label="Sort keys" checked={sort} onChange={setSort} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => format()} disabled={!input.trim()}>
          {indent === 0 ? <Minimize2 /> : <Sparkles />}
          {indent === 0 ? "Minify" : "Beautify"}
        </Button>
      </div>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function TextPanel() {
  const [input, setInput] = useState("");
  const [operation, setOperation] = useState<TextOperation>("join");
  const [separator, setSeparator] = useState(",");
  const [dropEmpty, setDropEmpty] = useState(true);
  const { result, error, run, reset } = useToolRun();

  function apply() {
    if (!input.trim()) {
      reset();
      return;
    }
    run(() => transformText({ input, operation, separator, dropEmpty }));
  }

  const needsSeparator = operation === "join" || operation === "split";

  return (
    <div className="space-y-4">
      <Field label="Text">
        <TextAreaControl
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={"web-01\nweb-02\ndb-01"}
        />
      </Field>

      <Field label="Operation">
        <div className="flex flex-wrap gap-1.5">
          {TEXT_OPERATIONS.map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => setOperation(op)}
              aria-pressed={op === operation}
              className={
                op === operation
                  ? "rounded-md bg-foreground/90 px-2.5 py-1 text-xs font-medium text-background"
                  : "rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground dark:bg-black/20 dark:hover:bg-black/30"
              }
            >
              {op}
            </button>
          ))}
        </div>
      </Field>

      <div className="flex flex-wrap items-end gap-4">
        {needsSeparator ? (
          <Field label="Separator" hint="\n and \t work" className="w-40">
            <TextControl
              value={separator}
              onChange={(event) => setSeparator(event.target.value)}
            />
          </Field>
        ) : null}
        <div className="pb-1">
          <Toggle label="Drop blank lines" checked={dropEmpty} onChange={setDropEmpty} />
        </div>
      </div>

      <Button size="sm" variant="secondary" onClick={apply} disabled={!input.trim()}>
        <Wand2 />
        Apply
      </Button>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function DurationPanel() {
  const [value, setValue] = useState("1h30m");
  const { result, error, run, reset } = useToolRun();

  useEffect(() => {
    if (!value.trim()) {
      reset();
      return;
    }
    run(() => convertDuration(value));
  }, [value, run, reset]);

  return (
    <div className="space-y-4">
      <Field label="Duration" hint="seconds, 1h30m, 2h 30min or PT1H30M">
        <TextControl
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="1h30m"
          autoComplete="off"
        />
      </Field>

      <div className="flex flex-wrap gap-1.5">
        {["90", "3600", "1h30m", "2h 30min", "PT1H30M", "7d"].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setValue(preset)}
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
