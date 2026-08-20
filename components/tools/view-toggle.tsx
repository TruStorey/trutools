"use client";

import { AppWindow, Terminal } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/** Which face of a tool the expanded panel shows. */
export type ToolView = "tool" | "api";

const OPTIONS = [
  { value: "tool", label: "Browser", icon: AppWindow },
  { value: "api", label: "API", icon: Terminal },
] as const satisfies readonly { value: ToolView; label: string; icon: unknown }[];

/**
 * The one control that decides which face every tool opens on.
 *
 * Deliberately global rather than per-card: someone who came here to script
 * something wants the API tab every time, not to flip it open tool by tool.
 * The Browser/API button inside an open panel writes to this same state, so
 * switching there also sets what the next tool you open will show.
 */
export function ViewToggle({
  value,
  onChange,
}: {
  value: ToolView;
  onChange: (value: ToolView) => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      role="radiogroup"
      aria-label="How to use the tools"
      className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 p-1 dark:bg-black/20"
    >
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              selected ? "text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {/*
              One element shared between the two buttons via layoutId, so it
              slides from one to the other instead of cross-fading two separate
              backgrounds. Painted first and left at z-auto — a negative z
              would drop it behind the container's own background, since
              neither the button nor the container opens a stacking context.
            */}
            {selected ? (
              <motion.span
                layoutId="view-toggle-indicator"
                className="absolute inset-0 rounded-lg bg-foreground/90"
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 400, damping: 34 }
                }
              />
            ) : null}

            <span className="relative z-10 inline-flex items-center gap-1.5">
              <Icon className="size-3.5" aria-hidden />
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
