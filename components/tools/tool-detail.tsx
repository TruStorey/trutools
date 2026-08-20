"use client";

import { AppWindow, Check, Copy, Terminal } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";

import { useIsland } from "@/components/island/island-provider";
import { CodeBlock } from "@/components/tools/code-block";
import { ToolIcon } from "@/components/tools/icon-map";
import { LanguageIcon } from "@/components/tools/language-icon";
import { ToolPanelFor } from "@/components/tools/panels";
import type { ToolView } from "@/components/tools/view-toggle";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import type { Tool } from "@/lib/tools/registry";
import {
  defaultOutput,
  isOutputAvailable,
  LANGUAGE_LABELS,
  outputsFor,
  SNIPPET_LANGUAGES,
  snippetFor,
  type OutputShape,
  type SnippetLanguage,
} from "@/lib/tools/snippets";
import { cn } from "@/lib/utils";

/** The small caption that sits above each section of the API tab. */
const FIELD_LABEL = "block text-[0.7rem] text-muted-foreground/70";

/** A row of small pills used for both the language and the format choice. */
function PillGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              selected
                ? "bg-foreground/90 text-background"
                : "border border-white/15 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground dark:bg-black/20 dark:hover:bg-black/30",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** The API reference tab: a snippet in your language, the parameters, the caveats. */
function ApiTab({ tool }: { tool: Tool }) {
  const { notify } = useIsland();
  const [copied, setCopied] = useState(false);
  const [language, setLanguage] = useState<SnippetLanguage>("curl");
  const [output, setOutput] = useState<OutputShape>("text");

  const kind = tool.api.resultKind;
  const outputs = outputsFor(language, kind);
  const snippet = snippetFor(tool, language, output);

  function changeLanguage(next: SnippetLanguage) {
    setLanguage(next);
    // Shapes are language-specific — a PowerShell hashtable has no Python
    // equivalent — so fall back to the new language's default when the
    // current choice does not carry over.
    if (!isOutputAvailable(next, kind, output)) {
      setOutput(defaultOutput(next, kind));
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      notify({
        variant: "success",
        title: `Copied ${LANGUAGE_LABELS[language]} snippet`,
        description: tool.name,
      });
    } catch {
      notify({ variant: "error", title: "Could not copy" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="space-y-1.5">
          <span className={FIELD_LABEL}>Language</span>
          <PillGroup
            label="Language"
            value={language}
            onChange={changeLanguage}
            options={SNIPPET_LANGUAGES.map((id) => ({
              value: id,
              label: LANGUAGE_LABELS[id],
              icon: <LanguageIcon language={id} className="size-3.5" />,
            }))}
          />
        </div>

        <div className="space-y-1.5 pt-0.5 pb-4">
          <span className={FIELD_LABEL}>
            {language === "curl" ? "Response" : "Returns"}
          </span>
          <PillGroup
            label={language === "curl" ? "Response format" : "Output shape"}
            value={output}
            onChange={setOutput}
            options={outputs}
          />
        </div>

        <CodeBlock
          code={snippet}
          language={language}
          action={
            <Button
              variant="ghost"
              size="xs"
              onClick={copy}
              aria-label={`Copy the ${LANGUAGE_LABELS[language]} snippet`}
              className="border border-white/10 bg-black/30 backdrop-blur-sm hover:bg-black/50"
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          }
        />
      </div>

      <div className="space-y-2">
        <h4 className={FIELD_LABEL}>Endpoint</h4>
        <p className="font-mono text-xs text-foreground/90">
          {tool.api.method} /{tool.id}
        </p>
      </div>

      {tool.api.params.length > 0 ? (
        <div className="space-y-2">
          <h4 className={FIELD_LABEL}>Parameters</h4>

          {/* The snippet above uses the short form, so say what the long one is. */}
          {tool.api.bareParam ? (
            <p className="text-xs text-muted-foreground">
              The snippet leaves{" "}
              <code className="font-mono text-foreground/90">{tool.api.bareParam}</code> unnamed,
              which this tool accepts. Writing{" "}
              <code className="font-mono text-foreground/90">{tool.api.bareParam}=</code> in front
              of the value works just the same, and is clearer when you are reading the URL back
              later.
            </p>
          ) : null}

          <dl className="space-y-1.5">
            {tool.api.params.map((param) => (
              <div key={param.name} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <dt className="font-mono font-medium text-foreground/90">{param.name}</dt>
                <span className="text-[0.65rem] text-muted-foreground/70">
                  {param.required ? "required" : "optional"}
                  {tool.api.bareParam === param.name ? " · name optional" : ""}
                </span>
                <dd className="w-full text-muted-foreground sm:w-auto sm:flex-1">
                  {param.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {/* This tool's own caveat, above the one every tool shares. */}
      {tool.api.note ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {tool.api.note}
        </p>
      ) : null}

      <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
        <Terminal className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p>
            Responses default to <code className="font-mono">text/plain</code>; add{" "}
            <code className="font-mono">?format=json</code> or{" "}
            <code className="font-mono">xml</code> (or an{" "}
            <code className="font-mono">Accept</code> header) for a parseable one.
          </p>
          <p>Errors come back in whichever format you asked for.</p>
          <p>
            Rate limited per IP — check{" "}
            <code className="font-mono">X-RateLimit-Remaining</code>, and{" "}
            <code className="font-mono">Retry-After</code> on a 429.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ToolDetail({
  tool,
  view,
  onViewChange,
}: {
  tool: Tool;
  view: ToolView;
  onViewChange: (view: ToolView) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const showingTool = view === "tool";

  return (
    // Same pure-CSS `liquid` glass as the cards, so the panel reads as part of
    // the same surface rather than a plain box that opened underneath them.
    <GlassCard glassVariant="liquid" className="gap-0 rounded-2xl p-5 py-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground/8 text-foreground/80">
          <ToolIcon name={tool.icon} className="size-4.5" />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-medium tracking-tight">{tool.name}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{tool.description}</p>
        </div>

        {/*
          One button, showing the view you are *not* looking at. It sits where
          the close button used to; the card's own chevron still collapses the
          panel, so nothing is lost by dropping the X.

          It writes to the grid's shared view state, so flipping it here also
          moves the Browser / API toggle above the grid.
        */}
        <button
          type="button"
          onClick={() => onViewChange(showingTool ? "api" : "tool")}
          aria-label={
            showingTool
              ? `Show the API reference for ${tool.name}`
              : `Show ${tool.name} in the browser`
          }
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-white/20 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-black/20 dark:hover:bg-black/30"
        >
          {showingTool ? (
            <>
              <Terminal className="size-3.5" />
              API
            </>
          ) : (
            <>
              <AppWindow className="size-3.5" />
              Browser
            </>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {showingTool ? <ToolPanelFor id={tool.id} /> : <ApiTab tool={tool} />}
        </motion.div>
      </AnimatePresence>
    </GlassCard>
  );
}
