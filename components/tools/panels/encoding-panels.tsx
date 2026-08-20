"use client";

import { useEffect, useState } from "react";

import { Field, Segmented, TextAreaControl, TextControl, Toggle } from "@/components/tools/controls";
import { ToolOutput } from "@/components/tools/tool-output";
import { useToolRun } from "@/components/tools/use-tool-run";
import { convertBase64, type Base64Mode } from "@/lib/tools/impl/base64";
import { convertBytes } from "@/lib/tools/impl/bytes";
import { calculateDiskSpace } from "@/lib/tools/impl/disk-space";
import { generateHashes, HASH_ALGORITHMS, type HashAlgorithm } from "@/lib/tools/impl/hash";
import { inspectJwt } from "@/lib/tools/impl/jwt";
import { convertYamlJson, type YamlJsonDirection } from "@/lib/tools/impl/yaml-json";
import { HASH_WEAK_ALGORITHM_NOTE } from "@/lib/tools/registry";

export function Base64Panel() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Base64Mode>("auto");
  const [urlSafe, setUrlSafe] = useState(false);
  const { result, error, run, reset } = useToolRun();

  useEffect(() => {
    if (!input.trim()) {
      reset();
      return;
    }
    run(() => convertBase64({ input, mode, urlSafe }));
  }, [input, mode, urlSafe, run, reset]);

  return (
    <div className="space-y-4">
      <Field label="Text or base64">
        <TextAreaControl
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="hello world"
        />
      </Field>

      <div className="flex flex-wrap items-end gap-4">
        <Segmented
          label="Direction"
          value={mode}
          onChange={setMode}
          options={[
            { value: "auto", label: "auto" },
            { value: "encode", label: "encode" },
            { value: "decode", label: "decode" },
          ]}
        />
        <div className="pb-1">
          <Toggle label="URL-safe" checked={urlSafe} onChange={setUrlSafe} />
        </div>
      </div>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function HashPanel() {
  const [input, setInput] = useState("");
  const [algorithm, setAlgorithm] = useState<HashAlgorithm | "all">("all");
  const { result, error, pending, runAsync, reset } = useToolRun();

  // Async because crypto.subtle.digest is; runAsync keeps the same error
  // handling as the synchronous tools.
  useEffect(() => {
    if (!input) {
      reset();
      return;
    }
    void runAsync(() =>
      generateHashes({ input, algorithm: algorithm === "all" ? undefined : algorithm }),
    );
  }, [input, algorithm, runAsync, reset]);

  return (
    <div className="space-y-4">
      <Field label="Text to hash">
        <TextAreaControl
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="hello world"
        />
      </Field>

      <Segmented
        label="Algorithm"
        value={algorithm}
        onChange={setAlgorithm}
        options={[
          { value: "all" as const, label: "all" },
          ...HASH_ALGORITHMS.map((id) => ({ value: id, label: id })),
        ]}
      />

      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        {HASH_WEAK_ALGORITHM_NOTE}
      </p>

      {pending ? <p className="text-xs text-muted-foreground">Hashing…</p> : null}
      <ToolOutput result={result} error={error} />
    </div>
  );
}

/**
 * Three boxes, any two of which answer the question.
 *
 * No mode switch deciding which one is the output: fill in the two you have
 * and the third arrives. Leaving all three filled is the only case that needs
 * saying out loud, because then they can contradict each other.
 */
export function DiskSpacePanel() {
  const [capacity, setCapacity] = useState("100TB");
  const [used, setUsed] = useState("40TB");
  const [percent, setPercent] = useState("");
  const { result, error, run, reset } = useToolRun();

  const filled = [capacity, used, percent].filter((field) => field.trim() !== "").length;

  useEffect(() => {
    if (filled !== 2) {
      reset();
      return;
    }
    run(() =>
      calculateDiskSpace({
        capacity: capacity || undefined,
        used: used || undefined,
        percent: percent || undefined,
      }),
    );
  }, [capacity, used, percent, filled, run, reset]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Capacity">
          <TextControl
            value={capacity}
            placeholder="100TB"
            onChange={(event) => setCapacity(event.target.value)}
          />
        </Field>
        <Field label="Used">
          <TextControl
            value={used}
            placeholder="40TB"
            onChange={(event) => setUsed(event.target.value)}
          />
        </Field>
        <Field label="Percent used">
          <TextControl
            value={percent}
            placeholder="70%"
            onChange={(event) => setPercent(event.target.value)}
          />
        </Field>
      </div>

      {filled === 2 ? null : (
        <p className="text-xs text-muted-foreground">
          {filled < 2
            ? "Fill in any two and the third is worked out."
            : "Clear one — with all three filled there is nothing left to work out, and they can disagree."}
        </p>
      )}

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function JwtPanel() {
  const [token, setToken] = useState("");
  const { result, error, run, reset } = useToolRun();

  useEffect(() => {
    if (!token.trim()) {
      reset();
      return;
    }
    run(() => inspectJwt(token));
  }, [token, run, reset]);

  return (
    <div className="space-y-4">
      <Field label="JSON Web Token">
        <TextAreaControl
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature"
        />
      </Field>

      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        Decoding only. The signature is not checked, so nothing here proves the token
        is genuine — anyone can craft one that reads however they like.
      </p>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function BytesPanel() {
  const [value, setValue] = useState("1.5");
  const [from, setFrom] = useState("GB");
  const { result, error, run } = useToolRun();

  useEffect(() => {
    run(() => convertBytes({ value: Number(value), from }));
  }, [value, from, run]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Value">
          <TextControl
            type="number"
            step="any"
            min={0}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <Field label="Unit">
          <TextControl value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["B", "kB", "MB", "GB", "TB", "KiB", "MiB", "GiB", "TiB"].map((unit) => (
          <button
            key={unit}
            type="button"
            onClick={() => setFrom(unit)}
            className={
              unit === from
                ? "rounded-md bg-foreground/90 px-2 py-1 text-xs font-medium text-background"
                : "rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground dark:bg-black/20 dark:hover:bg-black/30"
            }
          >
            {unit}
          </button>
        ))}
      </div>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function YamlJsonPanel() {
  const [input, setInput] = useState("");
  const [to, setTo] = useState<YamlJsonDirection>("auto");
  const { result, error, run, reset } = useToolRun();

  useEffect(() => {
    if (!input.trim()) {
      reset();
      return;
    }
    run(() => convertYamlJson({ input, to, indent: 2 }));
  }, [input, to, run, reset]);

  return (
    <div className="space-y-4">
      <Field label="YAML or JSON">
        <TextAreaControl
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={"name: trutools\nports:\n  - 3000"}
        />
      </Field>

      <Segmented
        label="Convert to"
        value={to}
        onChange={setTo}
        options={[
          { value: "auto", label: "auto" },
          { value: "json", label: "JSON" },
          { value: "yaml", label: "YAML" },
        ]}
      />

      <ToolOutput result={result} error={error} />
    </div>
  );
}
