import Link from "next/link";
import { Terminal } from "lucide-react";

import { DynamicIsland } from "@/components/island/dynamic-island";
import { ThemeToggle } from "@/components/theme-toggle";
import { glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";

export function SiteNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-background/50 backdrop-blur-xl backdrop-saturate-150">
      {/*
        Three columns with an `auto` middle: the island grows and shrinks as
        toasts come and go, and the 1fr side columns absorb the change so the
        pill stays optically centred instead of shoving the navbar around.
      */}
      <nav className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Terminal className="size-5 text-foreground/80" aria-hidden />
            <span className="text-base font-semibold tracking-tight">
              tru<span className="text-foreground/55">tools</span>
            </span>
          </Link>
        </div>

        <DynamicIsland />

        <div className="flex items-center justify-end gap-2">
          {/* GlassIcon renders a plain <button> and its cva lives in a client
              module, so this navbar (a server component) styles a real anchor
              directly rather than calling glassIconVariants().

              eslint-disable: /api/v1 is a route handler, not a page. next/link
              would try to client-side navigate to it and break. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/v1"
            aria-label="API documentation"
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-full",
              "text-foreground select-none outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              "transition-transform duration-150 active:scale-95 motion-reduce:transition-none",
              glassVariantStyles.frosted,
            )}
          >
            <span className="font-mono text-[0.65rem] leading-none">API</span>
          </a>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
