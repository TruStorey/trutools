"use client";

import { useEffect, useState } from "react";

export type ApiHealth = "checking" | "up" | "down";

const DEFAULT_INTERVAL_MS = 30_000;

/**
 * A request that never settles is a dead API, not a healthy one. Without this
 * the status would sit on "checking" forever while the socket hangs.
 */
const REQUEST_TIMEOUT_MS = 5_000;

/**
 * Polls /api/health so the island can show whether the API is reachable.
 *
 * /api/health is deliberately exempt from rate limiting and does not touch
 * Redis, so polling it costs nothing and a Redis blip does not show up here as
 * a false outage.
 */
export function useApiHealth(intervalMs = DEFAULT_INTERVAL_MS): ApiHealth {
  const [status, setStatus] = useState<ApiHealth>("checking");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function schedule() {
      if (cancelled) return;
      timer = setTimeout(check, intervalMs);
    }

    async function check() {
      if (cancelled) return;

      // Nothing is watching a hidden tab, so skip the request and wait for the
      // visibility change rather than polling a background tab forever.
      if (document.hidden) {
        schedule();
        return;
      }

      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch("/api/health", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!cancelled) setStatus(response.ok ? "up" : "down");
      } catch {
        // Aborted, offline, or DNS failure — all of them mean "not reachable".
        if (!cancelled) setStatus("down");
      } finally {
        clearTimeout(abortTimer);
      }

      schedule();
    }

    function onVisibilityChange() {
      if (document.hidden) return;
      // Coming back to the tab, re-check straight away instead of showing a
      // status that could be a full interval stale.
      if (timer) clearTimeout(timer);
      void check();
    }

    void check();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs]);

  return status;
}
