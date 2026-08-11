"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Field, TextControl } from "@/components/tools/controls";
import { ToolOutput } from "@/components/tools/tool-output";
import { useToolRun } from "@/components/tools/use-tool-run";
import { Button } from "@/components/ui/button";
import { DNS_TYPES } from "@/lib/tools/impl/server/dns";

/**
 * Calls our own endpoint rather than Cloudflare directly.
 *
 * The browser could query DoH itself, but then the panel and the API would be
 * two separate parsers of the same JSON, free to disagree. One implementation
 * on the server keeps them identical, and the lookup still costs one request.
 */
export function DnsPanel() {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("A");
  const { result, error, pending, runRemote } = useToolRun();

  function lookup(event?: FormEvent) {
    event?.preventDefault();
    if (!name.trim()) return;
    const params = new URLSearchParams({ name: name.trim(), type });
    void runRemote(`/api/v1/dns-lookup?${params}`);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={lookup} className="flex flex-wrap items-end gap-3">
        <Field label="Hostname" hint="a pasted URL works too" className="min-w-56 flex-1">
          <TextControl
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="example.com"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Button type="submit" size="sm" variant="secondary" disabled={pending || !name.trim()}>
          {pending ? <LoaderCircle className="animate-spin" /> : <Search />}
          {pending ? "Looking up…" : "Look up"}
        </Button>
      </form>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Record type</span>
        <div className="flex flex-wrap gap-1.5">
          {["all", ...DNS_TYPES].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              aria-pressed={option === type}
              className={
                option === type
                  ? "rounded-md bg-foreground/90 px-2 py-1 text-xs font-medium text-background"
                  : "rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground dark:bg-black/20 dark:hover:bg-black/30"
              }
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Queries are sent from this server to Cloudflare&apos;s resolver, not from your
        browser — so the lookup shows what the internet sees, not what your network
        resolves.
      </p>

      <ToolOutput result={result} error={error} />
    </div>
  );
}
