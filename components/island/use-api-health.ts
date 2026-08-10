"use client";

import { useEffect, useState } from "react";

export type ApiHealth = "checking" | "up" | "down";

export type ApiHealthState = {
  status: ApiHealth;
  /** The HTTP status the healthcheck answered with, or null if nothing came back. */
  code: number | null;
};

const DEFAULT_INTERVAL_MS = 30_000;

/**
 * A request that never settles is a dead API, not a healthy one. Without this
 * the status would sit on "checking" forever while the socket hangs.
 */
const REQUEST_TIMEOUT_MS = 5_000;

/**
 * Polls /api/health so the island can show whether the API is reachable, and
 * what it actually said.
 *
 * /api/health is deliberately exempt from rate limiting and does not touch
 * Redis, so polling it costs nothing and a Redis blip does not show up here as
 * a false outage.
 */
export function useApiHealth(intervalMs = DEFAULT_INTERVAL_MS): ApiHealthState {
  const [state, setState] = useState<ApiHealthState>({ status: "checking", code: null });

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
        if (!cancelled) {
          setState({ status: response.ok ? "up" : "down", code: response.status });
        }
      } catch {
        // Aborted, offline, or DNS failure — nothing answered, so there is no
        // status code to report, only that it is unreachable.
        if (!cancelled) setState({ status: "down", code: null });
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

  return state;
}

/**
 * Reason phrases for the codes a healthcheck plausibly returns. Anything else
 * falls back to the bare number rather than guessing.
 */
const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  408: "Request Timeout",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

/** e.g. "API: 200 OK", "API: 502 Bad Gateway", "API unreachable". */
export function healthLabel({ status, code }: ApiHealthState): string {
  if (status === "checking") return "Checking API status";
  if (code === null) return "API unreachable";

  const text = STATUS_TEXT[code];
  return text ? `API: ${code} ${text}` : `API: ${code}`;
}

export function healthDetail({ status, code }: ApiHealthState): string {
  if (status === "checking") return "Asking /api/health…";
  if (code === null) return "/api/health did not respond";
  if (status === "up") return "All endpoints reachable";
  return `/api/health returned ${code}`;
}
