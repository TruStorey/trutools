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
   * The same, for tools whose computation is asynchronous — the hashes, since
   * crypto.subtle.digest returns a promise. Still the tool's own function, so
   * this stays a local computation rather than a request.
   */
  const runAsync = useCallback(async (compute: () => Promise<ToolResult>) => {
    setPending(true);
    try {
      setResult(await compute());
      setError(null);
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof ToolInputError || caught instanceof Error
          ? caught.message
          : "something went wrong",
      );
    } finally {
      setPending(false);
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

  return { result, error, pending, run, runAsync, runRemote, reset };
}
