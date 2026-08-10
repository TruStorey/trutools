import Link from "next/link";
import { Terminal } from "lucide-react";

import { ApiInfoDialog } from "@/components/api-info-dialog";
import { DynamicIsland } from "@/components/island/dynamic-island";
import { ThemeToggle } from "@/components/theme-toggle";
import { describeWindow, rateLimitConfig } from "@/lib/api/rate-limit-config";
import { SITE_HOST } from "@/lib/site";

export function SiteNavbar() {
  // Server component, so the dialog can state the real configured limit
  // rather than a number hardcoded into the copy.
  const limit = rateLimitConfig();

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
          <ApiInfoDialog
            siteHost={SITE_HOST}
            rateLimit={{ max: limit.max, window: describeWindow(limit.windowSec) }}
          />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
