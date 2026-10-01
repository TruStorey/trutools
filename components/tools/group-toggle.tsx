"use client";

import { Shapes, Zap } from "lucide-react";

import { SegmentedToggle, type SegmentedOption } from "@/components/tools/segmented-toggle";

/**
 * How the grid is sectioned: by what a tool is about (crypto, networking…) or
 * by what it does, which is also the first segment of its URL.
 */
export type ToolGrouping = "type" | "verb";

const OPTIONS: readonly SegmentedOption<ToolGrouping>[] = [
  { value: "type", label: "Type", icon: Shapes },
  { value: "verb", label: "Verb", icon: Zap },
];

export function GroupToggle({
  value,
  onChange,
}: {
  value: ToolGrouping;
  onChange: (value: ToolGrouping) => void;
}) {
  return (
    <SegmentedToggle
      options={OPTIONS}
      value={value}
      onChange={onChange}
      label="Group tools by"
      layoutId="group-toggle-indicator"
    />
  );
}
