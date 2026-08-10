"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Field, Segmented, TextControl, Toggle } from "@/components/tools/controls";
import { ToolOutput } from "@/components/tools/tool-output";
import { useToolRun } from "@/components/tools/use-tool-run";
import { Button } from "@/components/ui/button";
import {
  generatePassword,
  passwordEntropyBits,
  PASSWORD_DEFAULTS,
  type PasswordOptions,
} from "@/lib/tools/impl/password";
import { generateToken, TOKEN_DEFAULTS, type TokenOptions } from "@/lib/tools/impl/token";
import { generateUuid, UUID_DEFAULTS, type UuidOptions } from "@/lib/tools/impl/uuid";

export function PasswordPanel() {
  const [options, setOptions] = useState<PasswordOptions>(PASSWORD_DEFAULTS);
  const { result, error, run } = useToolRun();

  function set<K extends keyof PasswordOptions>(key: K, value: PasswordOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  // Generate once on open, and again whenever an option changes, so the panel
  // is never sitting there empty waiting to be told to do its job.
  useEffect(() => {
    run(() => generatePassword(options));
  }, [options, run]);

  const bits = passwordEntropyBits(options);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Length" hint={`· ${bits} bits of entropy`}>
          <TextControl
            type="number"
            min={4}
            max={256}
            value={options.length}
            onChange={(event) => set("length", Number(event.target.value))}
          />
        </Field>
        <Field label="How many">
          <TextControl
            type="number"
            min={1}
            max={100}
            value={options.count}
            onChange={(event) => set("count", Number(event.target.value))}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Toggle label="a-z" checked={options.lowercase} onChange={(v) => set("lowercase", v)} />
        <Toggle label="A-Z" checked={options.uppercase} onChange={(v) => set("uppercase", v)} />
        <Toggle label="0-9" checked={options.digits} onChange={(v) => set("digits", v)} />
        <Toggle label="Symbols" checked={options.symbols} onChange={(v) => set("symbols", v)} />
        <Toggle
          label="No ambiguous"
          checked={options.excludeAmbiguous}
          onChange={(v) => set("excludeAmbiguous", v)}
        />
      </div>

      <Button size="sm" variant="secondary" onClick={() => run(() => generatePassword(options))}>
        <RefreshCw />
        Regenerate
      </Button>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function UuidPanel() {
  const [options, setOptions] = useState<UuidOptions>(UUID_DEFAULTS);
  const { result, error, run } = useToolRun();

  function set<K extends keyof UuidOptions>(key: K, value: UuidOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    run(() => generateUuid(options));
  }, [options, run]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Segmented
          label="Version"
          value={options.version}
          onChange={(value) => set("version", value)}
          options={[
            { value: 4, label: "v4 random" },
            { value: 7, label: "v7 sortable" },
          ]}
        />
        <Field label="How many" className="w-28">
          <TextControl
            type="number"
            min={1}
            max={1000}
            value={options.count}
            onChange={(event) => set("count", Number(event.target.value))}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Toggle label="Uppercase" checked={options.uppercase} onChange={(v) => set("uppercase", v)} />
        <Toggle label="Hyphens" checked={options.hyphens} onChange={(v) => set("hyphens", v)} />
      </div>

      <Button size="sm" variant="secondary" onClick={() => run(() => generateUuid(options))}>
        <RefreshCw />
        Regenerate
      </Button>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function TokenPanel() {
  const [options, setOptions] = useState<TokenOptions>(TOKEN_DEFAULTS);
  const { result, error, run } = useToolRun();

  function set<K extends keyof TokenOptions>(key: K, value: TokenOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    run(() => generateToken(options));
  }, [options, run]);

  return (
    <div className="space-y-4">
      <Segmented
        label="Encoding"
        value={options.encoding}
        onChange={(value) => set("encoding", value)}
        options={[
          { value: "base64url", label: "base64url" },
          { value: "hex", label: "hex" },
          { value: "base58", label: "base58" },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Entropy" hint="bytes">
          <TextControl
            type="number"
            min={8}
            max={256}
            value={options.bytes}
            onChange={(event) => set("bytes", Number(event.target.value))}
          />
        </Field>
        <Field label="Prefix" hint="optional">
          <TextControl
            placeholder="sk_live"
            value={options.prefix}
            onChange={(event) => set("prefix", event.target.value)}
          />
        </Field>
        <Field label="How many">
          <TextControl
            type="number"
            min={1}
            max={100}
            value={options.count}
            onChange={(event) => set("count", Number(event.target.value))}
          />
        </Field>
      </div>

      <Button size="sm" variant="secondary" onClick={() => run(() => generateToken(options))}>
        <RefreshCw />
        Regenerate
      </Button>

      <ToolOutput result={result} error={error} />
    </div>
  );
}
