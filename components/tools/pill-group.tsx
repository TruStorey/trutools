"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A row of small pills: the API tab's language and format choice, the MCP client choice. */
export function PillGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              selected
                ? "bg-foreground/90 text-background"
                : "border border-white/15 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground dark:bg-black/20 dark:hover:bg-black/30",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
