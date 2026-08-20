"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { glassVariantStyles } from "@/lib/glass-variants";
import { cn } from "@/lib/utils";

type AboutLink = {
  label: string;
  href: string;
  description: string;
};

const LINKS: AboutLink[] = [
  {
    label: "Source on GitHub",
    href: "https://github.com/TruStorey/trutools",
    description: "Every tool, the API, and the docs.",
  },
  {
    label: "icanhazip.com",
    href: "https://icanhazip.com",
    description: "The one that started it.",
  },
  {
    label: "it-tools.tech",
    href: "https://it-tools.tech/",
    description: "The other one that started it.",
  },
  {
    label: "Buy me a coffee",
    href: "https://buymeacoffee.com/trustorey",
    description: "If any of this saved you a few minutes.",
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold tracking-wider text-foreground/70 uppercase">
        {title}
      </h3>
      <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

/**
 * The story behind the site, and where to find its parts.
 *
 * Sibling of <ApiInfoDialog>: same trigger treatment, same frosted panel, so
 * the pair reads as one set of navbar affordances rather than two designs.
 */
export function AboutDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center rounded-lg px-2 py-1",
              "text-xs font-medium tracking-wide text-muted-foreground uppercase select-none",
              "transition-colors outline-none hover:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring/60",
            )}
          />
        }
      >
        About
      </DialogTrigger>

      <DialogContent
        className={cn(
          "max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl p-5 sm:max-w-lg",
          glassVariantStyles.frosted,
          "dark:bg-black/[0.75]",
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Info className="size-4" aria-hidden />
            About TruTools
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Section title="The idea">
            <p>
              Small utilities of the sort you otherwise keep a browser tab open
              or a half-remembered note somewhere.
            </p>
            <p>
              Each tool has two front doors onto the same function. Click it in
              the browser, or curl it from a terminal — same tool, same answer,
              no difference in what you get back.
            </p>
            <p>
              Available in many languages for you to use in your scripts or
              whatever you are most comfortable with.
            </p>
          </Section>

          <Section title="The inspiration">
            <p>
              None of this would have ever been a thought to me if it wasn&apos;t
              for the og and goat{" "}
              <a
                href="https://icanhazip.com"
                target="_blank"
                rel="noreferrer"
                className="text-foreground/85 underline underline-offset-2 hover:text-foreground"
              >
                ICANHAZIP
              </a>{" "}
              and{" "}
              <a
                href="https://it-tools.tech/"
                target="_blank"
                rel="noreferrer"
                className="text-foreground/85 underline underline-offset-2 hover:text-foreground"
              >
                IT-TOOLS
              </a>
              . icanhazip completely inspired the api aspect of the tools, while
              IT-TOOLS inspired, you guessed it, the tools. If you don&apos;t know
              these sites, please go check them out because they have been a
              goto of mine for many years.
            </p>
            <p>
              So nothing here asks who you are. Everything runs in your browser
              where it can, and the API is rate limited per IP rather than gated
              behind a signup.
            </p>
          </Section>

          <Section title="The Philosophy">
            <p>
              Free forever, and as simple as possible. As the saying goes
              &ldquo;Keep It Simple Stupid&rdquo;.
            </p>
          </Section>

          <Section title="Links">
            {/* list-disc because Tailwind's preflight resets list-style to
                none, so a bare <ul> renders without markers. */}
            <ul className="list-disc space-y-1.5 ps-4 marker:text-muted-foreground/50">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground/85 underline underline-offset-2 hover:text-foreground"
                  >
                    {link.label}
                  </a>{" "}
                  <span className="text-muted-foreground">{link.description}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
