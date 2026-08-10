"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * How many columns the grid is currently rendering.
 *
 * Read from the element's own computed `grid-template-columns` rather than
 * duplicating the Tailwind breakpoints in JS — the CSS stays the single
 * source of truth, so changing `md:grid-cols-3` needs no matching edit here.
 */
export function useGridColumns(ref: RefObject<HTMLElement | null>): number {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    function measure() {
      if (!element) return;
      const template = getComputedStyle(element).gridTemplateColumns;
      // Resolves to a track list like "240px 240px 240px 240px".
      const count = template.split(" ").filter(Boolean).length;
      setColumns(Math.max(1, count));
    }

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return columns;
}

/** Splits a list into rows of `size`. The last row may be short. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) return [items];
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}
