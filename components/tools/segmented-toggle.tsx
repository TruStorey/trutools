"use client";

import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon: LucideIcon;
};

/**
 * A pill of mutually exclusive options with a sliding indicator.
 *
 * `layoutId` must be unique per instance on a page. motion animates between
 * every element sharing one, so two toggles with the same id would fling the
 * indicator from one control to the other.
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  label,
  layoutId,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  layoutId: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 p-1 dark:bg-black/20"
    >
      {options.map((option) => {
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
              One element shared between the buttons via layoutId, so it
              slides from one to the other instead of cross-fading separate
              backgrounds. Painted first and left at z-auto — a negative z
              would drop it behind the container's own background, since
              neither the button nor the container opens a stacking context.
            */}
            {selected ? (
              <motion.span
                layoutId={layoutId}
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
