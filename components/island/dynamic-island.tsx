"use client";

import { CircleAlert, CircleCheck, Info, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { GlassTooltipContent } from "@/components/ui/glasscn/glass-tooltip";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useIsland, type IslandVariant } from "./island-provider";
import { useApiHealth, type ApiHealth } from "./use-api-health";

/**
 * Adapted from @smoothui/dynamic-island.
 *
 * The registry ships a *demo*: a fixed 200px-tall stage, a row of view-switcher
 * buttons, and five hardcoded scenes (weather, incoming call, timer,
 * notification, music player). None of that is useful as a toast surface, so it
 * is gone. What is kept is the motion recipe that makes the thing feel like an
 * island: a `layout`-animated pill with an explicit borderRadius, a spring whose
 * bounce varies by transition, and content that blurs in on swap.
 */

// Bounce is softer entering idle (a collapse should settle) and springier
// entering a message (an expansion should feel alive).
const BOUNCE = {
  toIdle: 0.3,
  toMessage: 0.45,
} as const;

const VARIANT_STYLES: Record<IslandVariant, { icon: typeof Info; tint: string }> = {
  success: { icon: CircleCheck, tint: "text-emerald-400" },
  error: { icon: CircleAlert, tint: "text-rose-400" },
  info: { icon: Info, tint: "text-sky-400" },
  loading: { icon: LoaderCircle, tint: "text-amber-400" },
};

const HEALTH_DOT: Record<
  ApiHealth,
  { className: string; label: string; detail: string }
> = {
  checking: {
    className: "bg-white/40",
    label: "Checking API status",
    detail: "Asking /api/health…",
  },
  up: {
    className: "bg-emerald-400",
    label: "API is up",
    detail: "All endpoints reachable",
  },
  // Pulsing so an outage is noticeable without the island having to expand.
  down: {
    className: "bg-rose-500 animate-pulse motion-reduce:animate-none",
    label: "API is down",
    detail: "/api/health is not responding",
  },
};

function IdlePill({ health }: { health: ApiHealth }) {
  const dot = HEALTH_DOT[health];

  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      {/* No `title` here — the native tooltip would race the glass one. */}
      <span className={cn("size-1.5 shrink-0 rounded-full", dot.className)} aria-hidden />
      <span className="font-mono text-xs tracking-[0.2em] text-white/70 select-none">
        TRUTOOLS
      </span>
      <span className="sr-only">{dot.label}</span>
    </div>
  );
}

/** What the glass tooltip shows on hover: the same status, spelled out. */
function HealthTooltip({ health }: { health: ApiHealth }) {
  const dot = HEALTH_DOT[health];

  return (
    <div className="flex items-start gap-2">
      <span className={cn("mt-1 size-1.5 shrink-0 rounded-full", dot.className)} aria-hidden />
      <div className="space-y-0.5">
        <p className="font-medium">{dot.label}</p>
        <p className="text-muted-foreground">{dot.detail}</p>
        <p className="pt-0.5 font-mono text-[0.65rem] text-muted-foreground/70">
          checked every 30s
        </p>
      </div>
    </div>
  );
}

export function DynamicIsland({ className }: { className?: string }) {
  const { current, dismiss } = useIsland();
  const shouldReduceMotion = useReducedMotion();
  // Polled here rather than inside IdlePill: the pill unmounts on every toast,
  // which would restart the poll each time a message came and went.
  const health = useApiHealth();

  const view = current ? current.id : "idle";
  const bounce = current ? BOUNCE.toMessage : BOUNCE.toIdle;

  const spring = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, bounce, duration: 0.3 };

  const Icon = current ? VARIANT_STYLES[current.variant].icon : null;

  return (
    <Tooltip>
      {/*
        The trigger renders as a plain div wrapping the island rather than
        Base UI's default button — the island already becomes a button when a
        toast is showing, and nesting one inside another is invalid.
      */}
      <TooltipTrigger
        render={<div className="mx-auto w-fit" />}
        aria-label={HEALTH_DOT[health].label}
      >
        <motion.div
          layout
          className={cn(
            "w-fit min-w-[132px] cursor-default overflow-hidden bg-black shadow-lg",
            "ring-1 ring-white/10",
            current && "cursor-pointer",
            className,
          )}
          style={{ borderRadius: 32 }}
          transition={spring}
          onClick={current ? () => dismiss(current.id) : undefined}
          role={current ? "button" : undefined}
          tabIndex={current ? 0 : undefined}
          onKeyDown={
            current
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    dismiss(current.id);
                  }
                }
              : undefined
          }
          aria-label={current ? "Dismiss notification" : undefined}
        >
          {/* aria-live so toasts are announced; the island is a status surface,
              not something the user is expected to go looking for. */}
          <div aria-live="polite" aria-atomic="true">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.92, filter: "blur(5px)" }
                }
                animate={
                  shouldReduceMotion
                    ? { opacity: 1 }
                    : {
                        opacity: 1,
                        scale: 1,
                        filter: "blur(0px)",
                        transition: { delay: 0.05 },
                      }
                }
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.95, filter: "blur(4px)" }
                }
                transition={spring}
              >
                {current && Icon ? (
                  <div className="flex max-w-[min(20rem,60vw)] items-center gap-2.5 px-4 py-2">
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        VARIANT_STYLES[current.variant].tint,
                        current.variant === "loading" &&
                          "animate-spin motion-reduce:animate-none",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm leading-tight font-medium text-white">
                        {current.title}
                      </p>
                      {current.description ? (
                        <p className="truncate text-xs leading-tight text-white/60">
                          {current.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <IdlePill health={health} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </TooltipTrigger>

      <GlassTooltipContent side="bottom" sideOffset={10}>
        <HealthTooltip health={health} />
      </GlassTooltipContent>
    </Tooltip>
  );
}
