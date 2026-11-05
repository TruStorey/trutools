"use client";

import { Palette } from "lucide-react";

import { useIsland } from "@/components/island/island-provider";
import { useSiteStyle } from "@/components/site-style/site-style-provider";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { isSiteStyle, SITE_STYLES } from "@/lib/site-style";
import { cn } from "@/lib/utils";

/** Navbar control for trying the site's alternate looks. */
export function StyleSwitcher() {
  const { style, setStyle } = useSiteStyle();
  const { notify } = useIsland();

  return (
    <Select
      value={style}
      onValueChange={(next) => {
        if (!isSiteStyle(next) || next === style) return;
        setStyle(next);
        const picked = SITE_STYLES.find((option) => option.id === next);
        notify({ variant: "info", title: `Style: ${picked?.label}`, description: picked?.description });
      }}
    >
      <SelectTrigger
        aria-label="Site style"
        title="Site style"
        size="sm"
        className={cn(
          // Icon only, and quieter than the text links beside it.
          "border-0 bg-transparent px-1.5 text-muted-foreground/70 dark:bg-transparent dark:hover:bg-transparent",
          // The select's built-in chevron would make it look like a dropdown field.
          "[&>svg:last-child]:hidden",
          "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
        )}
      >
        <Palette className="size-4" aria-hidden />
      </SelectTrigger>

      <SelectContent align="end" alignItemWithTrigger={false} className="min-w-44">
        {SITE_STYLES.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <span className="flex flex-col">
              <span>{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
