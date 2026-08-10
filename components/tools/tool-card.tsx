"use client";

import { ChevronDown } from "lucide-react";

import { ToolIcon } from "@/components/tools/icon-map";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import type { Tool } from "@/lib/tools/registry";
import { cn } from "@/lib/utils";

type ToolCardProps = {
  tool: Tool;
  expanded: boolean;
  onToggle: () => void;
};

/**
 * A card is just the trigger. The tool itself renders in <ToolDetail>, which
 * the grid inserts as a full-width row beneath this card's row — a 1/4-width
 * column is far too narrow for a subnet readout or a private key.
 */
export function ToolCard({ tool, expanded, onToggle }: ToolCardProps) {
  return (
    /*
      `liquid` is a pure-CSS glass variant. The `liquid-refract` default renders
      a per-element canvas displacement map and only works in Chromium — not
      worth it across a grid of cards.
    */
    <GlassCard
      glassVariant="liquid"
      className={cn(
        "glance glance-opacity-14 h-full gap-0 rounded-2xl py-0 transition-shadow",
        expanded && "ring-2 ring-ring/40",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`tool-detail-${tool.id}`}
        className="flex h-full w-full flex-col items-start gap-2.5 rounded-2xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
      >
        <span className="flex w-full items-start gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/8 text-foreground/80">
            <ToolIcon name={tool.icon} className="size-4" />
          </span>
          <ChevronDown
            className={cn(
              "mt-2 ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </span>

        <span className="text-sm font-medium tracking-tight">{tool.name}</span>
        <span className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {tool.description}
        </span>
      </button>
    </GlassCard>
  );
}
