"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { useIsland } from "@/components/island/island-provider";
import { Button } from "@/components/ui/button";
import { renderText, type ToolResult } from "@/lib/tools/result";
import { cn } from "@/lib/utils";

/**
 * Renders whatever a tool returned, in the shape it returned it.
 *
 * Every panel funnels through here, so output styling and the copy affordance
 * are defined once rather than ten times.
 */
export function ToolOutput({
  result,
  error,
  className,
}: {
  result: ToolResult | null;
  error: string | null;
  className?: string;
}) {
  const { notify } = useIsland();
  const [copied, setCopied] = useState(false);

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs break-words text-destructive"
      >
        {error}
      </p>
    );
  }

  if (!result) return null;

  async function copy(value: string, label = "Copied to clipboard") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      notify({ variant: "success", title: label });
    } catch {
      notify({
        variant: "error",
        title: "Could not copy",
        description: "Clipboard access was blocked",
      });
    }
  }

  const everything = renderText(result);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Output
        </span>
        <Button variant="ghost" size="xs" onClick={() => copy(everything, "Copied all output")}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy all"}
        </Button>
      </div>

      {result.kind === "lines" ? (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10 bg-black/15 backdrop-blur-sm dark:bg-black/25">
          {result.lines.map((line, index) => (
            <li
              key={`${index}-${line}`}
              className="group flex items-center gap-2 px-3 py-2 font-mono text-xs"
            >
              <span className="min-w-0 flex-1 break-all">{line}</span>
              <button
                type="button"
                onClick={() => copy(line)}
                aria-label={`Copy value ${index + 1}`}
                className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Copy className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {result.kind === "fields" ? (
        <dl className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10 bg-black/15 backdrop-blur-sm dark:bg-black/25">
          {result.fields.map((field) => (
            <div
              key={field.label}
              className="group grid gap-1 px-3 py-2 sm:grid-cols-[minmax(7rem,auto)_1fr] sm:gap-3"
            >
              <dt className="text-xs font-medium text-muted-foreground">{field.label}</dt>
              <dd className="flex min-w-0 items-start gap-2">
                {/* Multi-line values — private keys, SAN lists — keep their
                    line breaks and scroll rather than stretching the card. */}
                <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all">
                  {field.value}
                </pre>
                <button
                  type="button"
                  onClick={() => copy(field.value, `Copied ${field.label.toLowerCase()}`)}
                  aria-label={`Copy ${field.label}`}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Copy className="size-3.5" />
                </button>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {result.kind === "rows" ? (
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/15 backdrop-blur-sm dark:bg-black/25">
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-white/10">
                {result.columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="px-3 py-2 text-left font-medium whitespace-nowrap text-muted-foreground"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={index} className="border-b border-white/5 last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-1.5 whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {result.note ? (
            <p className="border-t border-white/10 px-3 py-2 font-sans text-xs text-muted-foreground">
              {result.note}
            </p>
          ) : null}
        </div>
      ) : null}

      {result.kind === "text" ? (
        <pre className="max-h-80 overflow-auto rounded-lg border border-white/10 bg-black/15 p-3 font-mono text-xs leading-relaxed backdrop-blur-sm dark:bg-black/25">
          <code>{result.text}</code>
        </pre>
      ) : null}
    </div>
  );
}
