"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SearchX } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { ToolCard } from "@/components/tools/tool-card";
import { ToolDetail } from "@/components/tools/tool-detail";
import { ToolSearch } from "@/components/tools/tool-search";
import { ViewToggle, type ToolView } from "@/components/tools/view-toggle";
import { chunk, useGridColumns } from "@/components/tools/use-grid-columns";
import { Button } from "@/components/ui/button";
import { filterTools } from "@/lib/tools/search";
import type { Section, Tool } from "@/lib/tools/registry";

type ToolGridProps = {
  tools: Tool[];
  sections: Section[];
};

/** How long the panel takes to open or close. */
const PANEL_SECONDS = 0.28;

/**
 * Where the opened card comes to rest, measured from the top of the viewport:
 * clear of the sticky navbar (h-16 in site-navbar.tsx) plus a little air.
 */
const CARD_REST_OFFSET = 80;

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
  view,
  onViewChange,
}: {
  tools: Tool[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  view: ToolView;
  onViewChange: (view: ToolView) => void;
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
                id={`tool-card-${tool.id}`}
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
                  transition={{ duration: PANEL_SECONDS, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Inner wrapper carries the spacing: animating height on a
                      box that also has margin makes the collapse jump. */}
                  <div className="pt-1 pb-1">
                    <ToolDetail
                      tool={openTool}
                      view={view}
                      onViewChange={onViewChange}
                    />
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
  const [view, setView] = useState<ToolView>("tool");
  const shouldReduceMotion = useReducedMotion();
  const previousExpandedId = useRef<string | null>(null);

  /*
    Bring the card that just opened to the same spot every time, so opening
    something near the bottom of the page does not leave its panel below the
    fold. The card rather than the panel: scrolling the panel to the top would
    push the card you just clicked off-screen.
  */
  useEffect(() => {
    const previous = previousExpandedId.current;
    previousExpandedId.current = expandedId;

    if (!expandedId) return;

    function rest() {
      const card = document.getElementById(`tool-card-${expandedId}`);
      if (!card) return;

      // Document coordinates, so this is the same answer whether or not an
      // earlier smooth scroll is still in flight.
      const wanted = card.getBoundingClientRect().top + window.scrollY - CARD_REST_OFFSET;
      const furthest = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);

      window.scrollTo({
        top: Math.min(wanted, furthest),
        behavior: shouldReduceMotion ? "auto" : "smooth",
      });
    }

    // A panel closing *above* this card drags it upward as it shrinks, so the
    // scroll would land short by that panel's height. Wait it out in that case
    // only — every other open starts moving straight away, with no dead pause.
    const closing =
      previous && previous !== expandedId
        ? document.getElementById(`tool-detail-${previous}`)
        : null;
    const card = document.getElementById(`tool-card-${expandedId}`);
    if (!card) return;

    const shifts =
      !shouldReduceMotion &&
      closing !== null &&
      closing.getBoundingClientRect().top < card.getBoundingClientRect().top;

    const start = shifts ? PANEL_SECONDS * 1000 : 0;

    /*
      Twice, because the last row cannot reach the rest position until the
      panel it just grew has finished growing: at the first pass the page is
      still short, so the clamp pins the scroll partway and the panel trails
      off below the fold. The second pass re-measures against the final page
      height and carries it the rest of the way to the bottom. For every other
      row both passes compute the same target, so the second is a no-op.
    */
    const timers = [
      setTimeout(rest, start),
      setTimeout(rest, start + PANEL_SECONDS * 1000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [expandedId, shouldReduceMotion]);

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
      <div className="flex flex-col items-center gap-3">
        <ToolSearch
          value={query}
          onChange={setQuery}
          resultCount={matches.length}
          totalCount={tools.length}
        />
        <ViewToggle value={view} onChange={setView} />
      </div>

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
                view={view}
                onViewChange={setView}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
