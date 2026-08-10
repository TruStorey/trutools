"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { GlassIcon } from "@/components/ui/glasscn/glass-icon";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // Both icons are always rendered and CSS picks the visible one off the `dark`
  // class on <html>. next-themes sets that class in a blocking inline script
  // before paint, so this is correct on the server render too — no `mounted`
  // flag, no hydration mismatch, no icon flash.
  return (
    <GlassIcon
      glassVariant="frosted"
      size="sm"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </GlassIcon>
  );
}
