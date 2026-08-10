"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SearchX } from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";

import { ToolCard } from "@/components/tools/tool-card";
import { ToolDetail } from "@/components/tools/tool-detail";
import { ToolSearch } from "@/components/tools/tool-search";
import { chunk, useGridColumns } from "@/components/tools/use-grid-columns";
import { Button } from "@/components/ui/button";
import { filterTools } from "@/lib/tools/search";
import type { Section, Tool } from "@/lib/tools/registry";

type ToolGridProps = {
  tools: Tool[];
  sections: Section[];
};

/**
 * One section: a 4-up card grid where the open tool's panel is inserted as a
 * full-width row directly beneath the row it belongs to, pushing everything
 * after it down and springing back on collapse.
 *
 * The panel has to be a real grid item placed between rows — not something
 * inside the card — or it would be stuck at one column wide.
 */
function SectionGrid({
  tools,
  expandedId,
  onToggle,
}: {
  tools: Tool[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const columns = useGridColumns(gridRef);
  const shouldReduceMotion = useReducedMotion();

  const rows = useMemo(() => chunk(tools, columns), [tools, columns]);

  return (
    <div
      ref={gridRef}
      // Default `stretch` alignment, so cards in a row share a height even when
      // one description wraps to two lines and another does not.
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {rows.map((row, rowIndex) => {
        const openTool = row.find((tool) => tool.id === expandedId);

        return (
          <Fragment key={rowIndex}>
            {row.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                expanded={expandedId === tool.id}
                onToggle={() => onToggle(tool.id)}
              />
            ))}

            <AnimatePresence initial={false} mode="wait">
              {openTool ? (
                <motion.div
                  key={openTool.id}
                  id={`tool-detail-${openTool.id}`}
                  className="col-span-full overflow-hidden"
                  initial={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : { height: "auto", opacity: 1 }
                  }
                  exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Inner wrapper carries the spacing: animating height on a
                      box that also has margin makes the collapse jump. */}
                  <div className="pt-1 pb-1">
                    <ToolDetail tool={openTool} />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Fragment>
        );
      })}
    </div>
  );
}

export function ToolGrid({ tools, sections }: ToolGridProps) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const matches = useMemo(() => filterTools(tools, query), [tools, query]);

  const visibleSections = useMemo(
    () =>
      sections
        .map((section) => ({
          section,
          tools: matches.filter((tool) => tool.section === section.id),
        }))
        // A section with nothing left in it should disappear entirely rather
        // than leave a dangling heading.
        .filter((group) => group.tools.length > 0),
    [sections, matches],
  );

  function toggle(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <div className="space-y-10">
      <ToolSearch
        value={query}
        onChange={setQuery}
        resultCount={matches.length}
        totalCount={tools.length}
      />

      {visibleSections.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 px-6 py-16 text-center">
          <SearchX className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            No tools match <span className="font-medium text-foreground">{query}</span>.
          </p>
          <Button variant="outline" size="sm" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      ) : (
        <div className="space-y-12">
          {visibleSections.map(({ section, tools: sectionTools }) => (
            <section key={section.id} aria-labelledby={`section-${section.id}`}>
              <div className="mb-4">
                <h2
                  id={`section-${section.id}`}
                  className="text-sm font-semibold tracking-wider text-foreground/70 uppercase"
                >
                  {section.name}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{section.description}</p>
              </div>

              <SectionGrid
                tools={sectionTools}
                expandedId={expandedId}
                onToggle={toggle}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
