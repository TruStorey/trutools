"use client";

import { LayoutGroup } from "motion/react";
import { SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import { ToolCard } from "@/components/tools/tool-card";
import { ToolSearch } from "@/components/tools/tool-search";
import { Button } from "@/components/ui/button";
import { filterTools } from "@/lib/tools/search";
import type { Section, Tool } from "@/lib/tools/registry";

type ToolGridProps = {
  tools: Tool[];
  sections: Section[];
};

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
        // One LayoutGroup across all sections so a card expanding in one
        // section animates neighbours in the others rather than snapping.
        <LayoutGroup>
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
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {section.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                  {sectionTools.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      tool={tool}
                      expanded={expandedId === tool.id}
                      onToggle={() =>
                        setExpandedId((current) => (current === tool.id ? null : tool.id))
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </LayoutGroup>
      )}
    </div>
  );
}
