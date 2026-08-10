"use client";

import { useCallback, useState } from "react";

import { ToolInputError, type ToolResult } from "@/lib/tools/result";

/**
 * Shared run/error/pending state for a tool panel.
 *
 * `run` takes the tool's own compute function — the exact same one the API
 * handler calls — so a panel never reimplements the logic it displays.
 */
export function useToolRun() {
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const run = useCallback((compute: () => ToolResult) => {
    try {
      setResult(compute());
      setError(null);
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof ToolInputError || caught instanceof Error
          ? caught.message
          : "something went wrong",
      );
    }
  }, []);

  /**
   * For the tools that cannot run in the browser (OpenSSH encoding, X.509
   * parsing). Calls our own public API and shows the plain-text body — which
   * is exactly what a `curl` user would see, so the two surfaces stay honest.
   */
  const runRemote = useCallback(
    async (path: string, init?: RequestInit) => {
      setPending(true);
      try {
        const response = await fetch(path, init);
        const text = await response.text();

        if (!response.ok) {
          setResult(null);
          setError(text.trim() || `request failed with ${response.status}`);
          return;
        }

        setResult({ kind: "text", text: text.replace(/\n$/, "") });
        setError(null);
      } catch {
        setResult(null);
        setError("could not reach the API");
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, error, pending, run, runRemote, reset };
}
