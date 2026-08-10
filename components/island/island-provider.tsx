"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type IslandVariant = "success" | "error" | "info" | "loading";

export type IslandMessage = {
  id: string;
  variant: IslandVariant;
  title: string;
  description?: string;
  /** Millis before auto-dismiss. Ignored for "loading", which is manual-only. */
  duration: number;
};

export type NotifyInput = {
  variant?: IslandVariant;
  title: string;
  description?: string;
  duration?: number;
};

type IslandContextValue = {
  /** The message currently on screen, or null when idle. */
  current: IslandMessage | null;
  /** Queue a message. Returns its id so it can be dismissed manually. */
  notify: (input: NotifyInput) => string;
  /** Drop a specific message, or the current one if no id is given. */
  dismiss: (id?: string) => void;
};

const IslandContext = createContext<IslandContextValue | null>(null);

const DEFAULT_DURATION = 3000;

export function IslandProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<IslandMessage[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = queue[0] ?? null;

  const notify = useCallback((input: NotifyInput) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const message: IslandMessage = {
      id,
      variant: input.variant ?? "info",
      title: input.title,
      description: input.description,
      duration: input.duration ?? DEFAULT_DURATION,
    };

    setQueue((previous) => [...previous, message]);
    return id;
  }, []);

  const dismiss = useCallback((id?: string) => {
    setQueue((previous) => {
      if (previous.length === 0) return previous;
      if (!id) return previous.slice(1);
      return previous.filter((message) => message.id !== id);
    });
  }, []);

  // One timer, always pinned to the head of the queue. Re-running on
  // current?.id means a new head restarts the clock rather than inheriting
  // whatever was left of the previous message's window.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!current || current.variant === "loading") return;

    timerRef.current = setTimeout(() => {
      setQueue((previous) => previous.filter((message) => message.id !== current.id));
    }, current.duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current]);

  const value = useMemo<IslandContextValue>(
    () => ({ current, notify, dismiss }),
    [current, notify, dismiss],
  );

  return <IslandContext.Provider value={value}>{children}</IslandContext.Provider>;
}

export function useIsland(): IslandContextValue {
  const context = useContext(IslandContext);
  if (!context) {
    throw new Error("useIsland must be used inside an <IslandProvider>");
  }
  return context;
}
