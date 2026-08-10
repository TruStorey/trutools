"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { GlassInput } from "@/components/ui/glasscn/glass-input";

type ToolSearchProps = {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
};

export function ToolSearch({ value, onChange, resultCount, totalCount }: ToolSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/") return;

      // Don't steal the keystroke from someone already typing somewhere.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="w-full max-w-xl">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />

        <GlassInput
          ref={inputRef}
          glassVariant="frosted"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onChange("");
              event.currentTarget.blur();
            }
          }}
          placeholder="Search tools…"
          aria-label="Search tools"
          className="h-11 pr-20 pl-10 text-base"
        />

        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute top-1/2 right-3 z-10 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <X className="size-4" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute top-1/2 right-3 z-10 hidden -translate-y-1/2 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground sm:block">
            /
          </kbd>
        )}
      </div>

      {/* Announced so keyboard and screen-reader users learn the filter worked. */}
      <p aria-live="polite" className="mt-2 h-4 text-xs text-muted-foreground">
        {value ? `${resultCount} of ${totalCount} tools` : ""}
      </p>
    </div>
  );
}
