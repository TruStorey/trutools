"use client";

import type { ReactNode } from "react";

import { tokenize, type TokenType } from "@/lib/tools/highlight";
import type { SnippetLanguage } from "@/lib/tools/snippets";
import { cn } from "@/lib/utils";

/**
 * Token colours.
 *
 * Chosen to sit on the dark recessed panel inside the glass card, and to stay
 * legible in light mode where that recess is lighter — hence the explicit
 * light-mode pairs rather than a single palette.
 */
const TOKEN_CLASS: Record<TokenType, string> = {
  comment: "text-muted-foreground/60 italic",
  string: "text-emerald-700 dark:text-emerald-300",
  number: "text-amber-700 dark:text-amber-300",
  keyword: "text-violet-700 dark:text-violet-300",
  variable: "text-sky-700 dark:text-sky-300",
  flag: "text-rose-700 dark:text-rose-300",
  punctuation: "text-foreground/50",
  plain: "",
};

export function CodeBlock({
  code,
  language,
  className,
  action,
}: {
  code: string;
  language: SnippetLanguage;
  className?: string;
  /** Rendered pinned to the top right, over the code. */
  action?: ReactNode;
}) {
  const tokens = tokenize(code, language);

  const block = (
    <pre
      className={cn(
        "overflow-x-auto rounded-lg border border-white/10 bg-black/15 p-3 font-mono text-xs leading-relaxed backdrop-blur-sm dark:bg-black/25",
        // Keep long lines from running under the button.
        action && "pr-20",
        className,
      )}
    >
      <code>
        {tokens.map((token, index) => (
          <span
            // Tokens are positional and the list is regenerated wholesale on
            // every language or format change, so the index is a stable key.
            key={index}
            className={TOKEN_CLASS[token.type]}
          >
            {token.value}
          </span>
        ))}
      </code>
    </pre>
  );

  if (!action) return block;

  // The action sits outside the <pre>, not inside it: an absolutely positioned
  // child of a scrolling box scrolls away with the content.
  return (
    <div className="relative">
      {block}
      <div className="absolute top-2 right-2">{action}</div>
    </div>
  );
}
