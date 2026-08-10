"use client";

import { Check, Copy, Terminal, X } from "lucide-react";
import { useState } from "react";

import { useIsland } from "@/components/island/island-provider";
import { ToolIcon } from "@/components/tools/icon-map";
import { ToolPanelFor } from "@/components/tools/panels";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Tool } from "@/lib/tools/registry";

/** The API reference tab: the curl line, the parameters, and how to pipe it. */
function ApiTab({ tool }: { tool: Tool }) {
  const { notify } = useIsland();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tool.api.example);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      notify({ variant: "success", title: "Copied curl command", description: tool.name });
    } catch {
      notify({ variant: "error", title: "Could not copy" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            {tool.api.method} /api/v1/{tool.id}
          </span>
          <Button variant="ghost" size="xs" onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/15 p-3 font-mono text-xs leading-relaxed backdrop-blur-sm dark:bg-black/25">
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

      <p className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
        <Terminal className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Responses are <code className="font-mono">text/plain</code> and rate limited per IP.
          Check <code className="font-mono">X-RateLimit-Remaining</code>, and{" "}
          <code className="font-mono">Retry-After</code> on a 429.
        </span>
      </p>
    </div>
  );
}

export function ToolDetail({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  return (
    // Same pure-CSS `liquid` glass as the cards, so the panel reads as part of
    // the same surface rather than a plain box that opened underneath them.
    <GlassCard glassVariant="liquid" className="gap-0 rounded-2xl p-5 py-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground/8 text-foreground/80">
          <ToolIcon name={tool.icon} className="size-4.5" />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-medium tracking-tight">{tool.name}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{tool.description}</p>
        </div>

        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={`Close ${tool.name}`}>
          <X />
        </Button>
      </div>

      <Tabs defaultValue="tool">
        {/* The default TabsList is an opaque bg-muted bar, which punches a
            solid rectangle through the glass. */}
        <TabsList className="border border-white/15 bg-white/10 dark:bg-black/20">
          <TabsTrigger value="tool">Tool</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent value="tool" className="pt-3">
          <ToolPanelFor id={tool.id} />
        </TabsContent>

        <TabsContent value="api" className="pt-3">
          <ApiTab tool={tool} />
        </TabsContent>
      </Tabs>
    </GlassCard>
  );
}
