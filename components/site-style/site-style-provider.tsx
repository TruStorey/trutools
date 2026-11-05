"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_STYLE,
  isSiteStyle,
  SITE_STYLE_STORAGE_KEY,
  type SiteStyle,
} from "@/lib/site-style";

type SiteStyleContextValue = {
  style: SiteStyle;
  setStyle: (style: SiteStyle) => void;
};

const SiteStyleContext = createContext<SiteStyleContextValue | null>(null);

function readStored(): SiteStyle | null {
  try {
    const stored = localStorage.getItem(SITE_STYLE_STORAGE_KEY);
    return isSiteStyle(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Holds the chosen style for the components whose *markup* differs by style
 * (the command list, the bento blocks). Anything that is only a matter of
 * CSS keys off `data-style` on <html> instead, which the pre-paint script has
 * already set — so those parts never flash, and only the layout swaps in
 * after hydration.
 */
export function SiteStyleProvider({ children }: { children: ReactNode }) {
  // Server and first client render agree on the default; the stored value
  // arrives in the layout effect below, before paint.
  const [style, setStyleState] = useState<SiteStyle>(DEFAULT_STYLE);

  useLayoutEffect(() => {
    const stored = readStored();
    // Also re-applies the attribute after the dev Strict Mode remount, which
    // resets <html> to the attributes React manages and drops this one.
    document.documentElement.setAttribute("data-style", stored ?? DEFAULT_STYLE);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from storage once on mount
    if (stored) setStyleState(stored);
  }, []);

  const setStyle = useCallback((next: SiteStyle) => {
    setStyleState(next);
    document.documentElement.setAttribute("data-style", next);
    try {
      localStorage.setItem(SITE_STYLE_STORAGE_KEY, next);
    } catch {
      // Private window or blocked storage: the choice just won't survive a reload.
    }
  }, []);

  const value = useMemo(() => ({ style, setStyle }), [style, setStyle]);

  return <SiteStyleContext.Provider value={value}>{children}</SiteStyleContext.Provider>;
}

export function useSiteStyle(): SiteStyleContextValue {
  const context = useContext(SiteStyleContext);
  if (!context) throw new Error("useSiteStyle must be used inside <SiteStyleProvider>");
  return context;
}
