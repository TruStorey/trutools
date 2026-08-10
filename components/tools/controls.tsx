"use client";

import { useId, type ReactNode } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Label + control, stacked. The layout every panel field uses. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {hint ? <span className="ml-1 text-muted-foreground/60">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

const CONTROL_CLASS =
  "h-9 w-full rounded-lg border border-border/60 bg-background/50 px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

export function TextControl({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return <input className={cn(CONTROL_CLASS, "font-mono", className)} {...props} />;
}

export function SelectControl({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return <select className={cn(CONTROL_CLASS, "cursor-pointer", className)} {...props} />;
}

export function TextAreaControl({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      spellCheck={false}
      className={cn(
        "min-h-32 w-full resize-y rounded-lg border border-border/60 bg-background/50 p-3 font-mono text-xs leading-relaxed outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A segmented control for small enums — versions, encodings, key types.
 * Reads better than a dropdown inside a card, and shows every option at once.
 */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex w-fit rounded-lg border border-border/60 bg-background/40 p-0.5"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-[7px] px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                selected
                  ? "bg-foreground/90 text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Switch with a label, laid out inline. */
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} size="sm" checked={checked} onCheckedChange={onChange} />
      <label htmlFor={id} className="cursor-pointer text-xs text-muted-foreground select-none">
        {label}
      </label>
    </div>
  );
}
