"use client";

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
}: {
  code: string;
  language: SnippetLanguage;
  className?: string;
}) {
  const tokens = tokenize(code, language);

  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-lg border border-white/10 bg-black/15 p-3 font-mono text-xs leading-relaxed backdrop-blur-sm dark:bg-black/25",
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
}
