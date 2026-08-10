"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { useIsland } from "@/components/island/island-provider";
import { Button } from "@/components/ui/button";
import { GlassSeparator } from "@/components/ui/glasscn/glass-separator";
import type { Tool } from "@/lib/tools/registry";

/**
 * The expanded body of a tool card.
 *
 * The tools themselves are not implemented yet, so this documents the API
 * contract instead of pretending to compute anything. When a tool lands, its
 * controls go here above the API reference.
 */
export function ToolPanel({ tool }: { tool: Tool }) {
  const { notify } = useIsland();
  const [copied, setCopied] = useState(false);

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(tool.api.example);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify({
        variant: "success",
        title: "Copied to clipboard",
        description: `${tool.name} example`,
      });
    } catch {
      // Clipboard access fails on insecure origins and when the user denies it.
      notify({
        variant: "error",
        title: "Could not copy",
        description: "Clipboard access was blocked",
      });
    }
  }

  return (
    <div className="space-y-4">
      <GlassSeparator />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            API
          </h4>
          <Button variant="ghost" size="xs" onClick={copyExample}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <pre className="overflow-x-auto rounded-lg border border-border/50 bg-background/40 p-3 font-mono text-xs leading-relaxed text-foreground/85">
          <code>{tool.api.example}</code>
        </pre>
      </div>

      {tool.api.params.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Parameters
          </h4>
          <dl className="space-y-1.5">
            {tool.api.params.map((param) => (
              <div key={param.name} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <dt className="font-mono font-medium text-foreground/90">{param.name}</dt>
                <span className="text-[0.65rem] text-muted-foreground/70">
                  {param.required ? "required" : "optional"}
                </span>
                <dd className="w-full text-muted-foreground sm:w-auto sm:flex-1">
                  {param.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {tool.api.status === "planned" ? (
        <p className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
          Not built yet — the interface and the endpoint above are the plan, not a
          working tool.
        </p>
      ) : null}
    </div>
  );
}
