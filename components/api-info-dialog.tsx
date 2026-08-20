"use client";

import { ExternalLink, Terminal } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { describeWindow } from "@/lib/api/rate-limit-config";
import { glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";

type ApiInfoDialogProps = {
  siteHost: string;
  /** Server-rendered fallback; refreshed from /api/health when opened. */
  rateLimit: { max: number; window: string };
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold tracking-wider text-foreground/70 uppercase">
        {title}
      </h3>
      <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.95em] text-foreground/85 dark:bg-black/30">
      {children}
    </code>
  );
}

export function ApiInfoDialog({ siteHost, rateLimit }: ApiInfoDialogProps) {
  const [limit, setLimit] = useState(rateLimit);

  /**
   * The homepage is statically prerendered, so the limit passed in as a prop
   * was read at build time. RATE_LIMIT_MAX is a runtime variable, so re-read
   * the policy from /api/health on open — it advertises the live values and is
   * exempt from the limit, so this costs nothing.
   */
  async function refreshLimit(open: boolean) {
    if (!open) return;
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const max = Number(response.headers.get("x-ratelimit-limit"));
      const windowSec = Number(response.headers.get("x-ratelimit-window"));
      if (Number.isFinite(max) && max > 0 && Number.isFinite(windowSec) && windowSec > 0) {
        setLimit({ max, window: describeWindow(windowSec) });
      }
    } catch {
      // Keep the server-rendered numbers; they are right unless the env
      // changed after the build.
    }
  }

  return (
    <Dialog onOpenChange={refreshLimit}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="About the API"
            className={cn(
              "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full",
              "text-foreground select-none outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              "transition-transform duration-150 active:scale-95 motion-reduce:transition-none",
              glassVariantStyles.frosted,
            )}
          />
        }
      >
        <span className="font-mono text-[0.65rem] leading-none">API</span>
      </DialogTrigger>

      {/*
        The stock DialogContent is bg-popover, which is opaque and would sit on
        the page like a plain card. Overridden to the same frosted glass the
        rest of the chrome uses; tailwind-merge drops bg-popover for it.

        The fill is then pushed well past what `frosted` carries. This dialog is
        a wall of small text over a busy card grid, and at the shared 0.35 the
        grid showed through it. Overridden here rather than in the variant,
        which the navbar and search field share and which look right as they are.
      */}
      <DialogContent
        className={cn(
          "max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl p-5 sm:max-w-lg",
          glassVariantStyles.frosted,
          "dark:bg-black/[0.75]",
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Terminal className="size-4" aria-hidden />
            The trutools API
          </DialogTitle>
          <DialogDescription className="text-xs">
            Every tool on this page is also an HTTP endpoint. No key, no account,
            no signup.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Section title="Endpoints">
            <p>
              <Code>{siteHost}/&lt;tool&gt;</Code> — or the versioned{" "}
              <Code>/api/v1/&lt;tool&gt;</Code>, which is the same endpoint and
              will keep working if a <Code>/v2</Code> ever appears.
            </p>
            <p>
              Most tools are <Code>GET</Code> with query parameters. The three that
              take a document — certificate reader, JSON beautifier and text tool —
              want it <Code>POST</Code>ed as the raw request body.
            </p>
          </Section>

          <Section title="Rate limit">
            <p>
              <strong className="text-foreground/85">
                {limit.max} requests per {limit.window}, per IP.
              </strong>{" "}
              It is a sliding window, so there is no reset-boundary burst to game.
            </p>
            <p>
              Every response carries <Code>X-RateLimit-Limit</Code>,{" "}
              <Code>X-RateLimit-Remaining</Code> and <Code>X-RateLimit-Reset</Code>.
              Go over and you get a <Code>429</Code> with <Code>Retry-After</Code>{" "}
              set to the real wait, not a flat guess. Rejected requests are not
              counted, so retrying early does not extend your own lockout.
            </p>
          </Section>

          <Section title="Response formats">
            <p>
              Plain text by default. Add <Code>?format=json</Code> or{" "}
              <Code>?format=xml</Code>, or send an <Code>Accept</Code> header of{" "}
              <Code>application/json</Code> or <Code>application/xml</Code>.
            </p>
            <p>
              Errors come back in whichever format you asked for, so a JSON client
              never has to parse a plain-text error.
            </p>
          </Section>

          <Section title="From a browser">
            <p>
              CORS is open (<Code>Access-Control-Allow-Origin: *</Code>), so you can
              call it straight from client-side JavaScript on any origin.
            </p>
          </Section>

          <Section title="What is kept">
            <p>
              Nothing generated is stored. Passwords, tokens and keys are computed
              for the request and forgotten.
            </p>
            <p>
              Your IP address is held in Redis for the length of the rate-limit
              window — that is how the limit is counted — and unhandled errors are
              written to the server log.
            </p>
          </Section>

          <Section title="Fair use">
            <p>
              This is a free service run on modest hardware with no uptime
              guarantee. Please do not put it in the critical path of anything that
              matters, and generate production secrets with a tool you control.
            </p>
          </Section>
        </div>

        <a
          href="/api/v1"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none dark:bg-black/20 dark:hover:bg-black/30"
        >
          Full endpoint reference
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </DialogContent>
    </Dialog>
  );
}
