"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { FrostGlassVariantProp, glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";

/**
 * A glass tooltip popup.
 *
 * glasscn ships a `tooltip` primitive but no glass wrapper for it, so this
 * follows the same shape as its other `glass-*` components.
 *
 * Deliberately arrow-less: the stock arrow is a rotated square filled with
 * `bg-foreground`, and a translucent one reads as a smudge because its blur
 * does not line up with the popup's. A detached pill is both cleaner and
 * closer to the island it hangs off.
 */
function GlassTooltipContent({
  className,
  glassVariant = "frosted",
  side = "bottom",
  sideOffset = 10,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  FrostGlassVariantProp &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="glass-tooltip-content"
          data-glass-variant={glassVariant}
          className={cn(
            "z-50 w-fit max-w-xs origin-(--transform-origin) rounded-xl px-3 py-2 text-xs text-foreground",
            glassVariantStyles[glassVariant],
            "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { GlassTooltipContent };
