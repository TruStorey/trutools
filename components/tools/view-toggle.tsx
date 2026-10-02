"use client";

import { AppWindow, Terminal } from "lucide-react";

import { SegmentedToggle, type SegmentedOption } from "@/components/tools/segmented-toggle";

/** Which face of a tool the expanded panel shows. */
export type ToolView = "tool" | "api";

const OPTIONS: readonly SegmentedOption<ToolView>[] = [
  { value: "tool", label: "Browser", icon: AppWindow },
  { value: "api", label: "API", icon: Terminal },
];

/**
 * The one control that decides which face every tool opens on.
 *
 * Deliberately global rather than per-card: someone who came here to script
 * something wants the API tab every time, not to flip it open tool by tool.
 * The Browser/API button inside an open panel writes to this same state, so
 * switching there also sets what the next tool you open will show.
 */
export function ViewToggle({
  value,
  onChange,
}: {
  value: ToolView;
  onChange: (value: ToolView) => void;
}) {
  return (
    <SegmentedToggle
      options={OPTIONS}
      value={value}
      onChange={onChange}
      label="Method"
      layoutId="view-toggle-indicator"
    />
  );
}
