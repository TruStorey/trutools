"use client";

import { LoaderCircle, MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Field, TextControl } from "@/components/tools/controls";
import { ToolOutput } from "@/components/tools/tool-output";
import { useToolRun } from "@/components/tools/use-tool-run";
import { Button } from "@/components/ui/button";

/**
 * Calls our own endpoint, for the same reason the DNS panel does: the SPF walk
 * is a recursive parse, and having a second copy of it in the browser would
 * mean two implementations free to disagree about the number that matters.
 */
export function MailPanel() {
  const [domain, setDomain] = useState("");
  const { result, error, pending, runRemote } = useToolRun();

  function check(event?: FormEvent) {
    event?.preventDefault();
    if (!domain.trim()) return;
    void runRemote(`/api/v1/mail-check?domain=${encodeURIComponent(domain.trim())}`);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={check} className="flex flex-wrap items-end gap-3">
        <Field label="Domain" hint="a URL or email address works too" className="min-w-56 flex-1">
          <TextControl
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="example.com"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Button type="submit" size="sm" variant="secondary" disabled={pending || !domain.trim()}>
          {pending ? <LoaderCircle className="animate-spin" /> : <MailCheck />}
          {pending ? "Checking…" : "Check"}
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {["github.com", "google.com", "cloudflare.com", "oracle.com"].map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setDomain(example)}
            className="rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-[0.7rem] text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground dark:bg-black/20 dark:hover:bg-black/30"
          >
            {example}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        The ten-lookup budget is enforced by whoever <em>receives</em> your mail, not by
        DNS — so nothing warns you when a new service pushes you over it and delivery
        starts failing.
      </p>

      <ToolOutput result={result} error={error} />
    </div>
  );
}
