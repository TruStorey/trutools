"use client";

import { useEffect, useState } from "react";

import { Field, TextControl } from "@/components/tools/controls";
import { ToolOutput } from "@/components/tools/tool-output";
import { useToolRun } from "@/components/tools/use-tool-run";
import { convertBandwidth } from "@/lib/tools/impl/bandwidth";
import { convertIpRange } from "@/lib/tools/impl/ip-range";

function Chips({
  values,
  active,
  onPick,
  mono = true,
}: {
  values: string[];
  active: string;
  onPick: (value: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onPick(value)}
          aria-pressed={value === active}
          className={
            (value === active
              ? "rounded-md bg-foreground/90 px-2 py-1 text-background "
              : "rounded-md border border-white/15 bg-white/5 px-2 py-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground dark:bg-black/20 dark:hover:bg-black/30 ") +
            `text-xs font-medium ${mono ? "font-mono" : ""}`
          }
        >
          {value}
        </button>
      ))}
    </div>
  );
}

export function IpRangePanel() {
  const [input, setInput] = useState("10.0.0.5-10.0.0.30");
  const { result, error, run } = useToolRun();

  useEffect(() => {
    if (!input.trim()) return;
    run(() => convertIpRange({ input }));
  }, [input, run]);

  return (
    <div className="space-y-4">
      <Field label="Range or CIDR" hint="10.0.0.5-10.0.0.30, or 10.0.0.0/22">
        <TextControl
          value={input}
          onChange={(event) => setInput(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <Chips
        values={[
          "10.0.0.5-10.0.0.30",
          "192.168.1.0/24",
          "172.16.5.7-172.16.9.200",
          "2001:db8::1-2001:db8::ff",
        ]}
        active={input}
        onPick={setInput}
      />

      <ToolOutput result={result} error={error} />
    </div>
  );
}

const RATE_UNITS = ["Mbps", "Gbps", "MB/s", "MiB/s"];
const SIZE_UNITS = ["GB", "GiB", "TB", "TiB"];

export function BandwidthPanel() {
  const [rate, setRate] = useState("1");
  const [rateUnit, setRateUnit] = useState("Gbps");
  const [size, setSize] = useState("1");
  const [sizeUnit, setSizeUnit] = useState("TiB");
  const [overhead, setOverhead] = useState("6");
  const { result, error, run } = useToolRun();

  useEffect(() => {
    run(() =>
      convertBandwidth({
        rate: Number(rate),
        rateUnit,
        size: size.trim() ? Number(size) : undefined,
        sizeUnit,
        overhead: Number(overhead) || 0,
      }),
    );
  }, [rate, rateUnit, size, sizeUnit, overhead, run]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Link rate">
          <TextControl
            type="number"
            step="any"
            min={0}
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </Field>
        <Field label="Transfer size" hint="optional">
          <TextControl
            type="number"
            step="any"
            min={0}
            value={size}
            onChange={(event) => setSize(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Rate unit</span>
          <Chips values={RATE_UNITS} active={rateUnit} onPick={setRateUnit} />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Size unit</span>
          <Chips values={SIZE_UNITS} active={sizeUnit} onPick={setSizeUnit} />
        </div>
      </div>

      <Field label="Protocol overhead" hint="percent — about 6 for TCP over Ethernet">
        <TextControl
          type="number"
          step="any"
          min={0}
          max={99}
          value={overhead}
          onChange={(event) => setOverhead(event.target.value)}
        />
      </Field>

      <ToolOutput result={result} error={error} />
    </div>
  );
}
