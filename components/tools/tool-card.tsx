"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ToolIcon } from "@/components/tools/icon-map";
import { ToolPanel } from "@/components/tools/tool-panel";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { CardContent } from "@/components/ui/card";
import type { Tool } from "@/lib/tools/registry";
import { cn } from "@/lib/utils";

type ToolCardProps = {
  tool: Tool;
  expanded: boolean;
  onToggle: () => void;
};

export function ToolCard({ tool, expanded, onToggle }: ToolCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const panelId = `tool-panel-${tool.id}`;

  return (
    <motion.div
      layout={shouldReduceMotion ? false : "position"}
      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
      className={cn(expanded && "md:col-span-2")}
    >
      {/*
        `liquid` is a pure-CSS glass variant. The `liquid-refract` default
        renders a per-element canvas displacement map and only works in
        Chromium — not worth it across a grid of cards.
      */}
      <GlassCard
        glassVariant="liquid"
        className="glance glance-opacity-14 h-full gap-0 rounded-2xl py-0"
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex w-full items-start gap-3 rounded-2xl p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
        >
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground/8 text-foreground/80">
            <ToolIcon name={tool.icon} className="size-4.5" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="font-medium tracking-tight">{tool.name}</span>
              {tool.api.status === "live" ? (
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[0.6rem] font-medium tracking-wide text-emerald-600 uppercase dark:text-emerald-400">
                  live
                </span>
              ) : null}
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
              {tool.description}
            </span>
          </span>

          <ChevronDown
            className={cn(
              "mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              id={panelId}
              key="panel"
              initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <CardContent className="px-5 pb-5">
                <ToolPanel tool={tool} />
              </CardContent>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}
