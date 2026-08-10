import { SECTIONS, type Tool } from "./registry";

const SECTION_NAMES = new Map(SECTIONS.map((section) => [section.id, section.name]));

/**
 * Everything a tool can be matched on, lowercased once per tool.
 * With ten tools this is cheap enough to recompute on every keystroke.
 */
function haystack(tool: Tool): string {
  return [
    tool.name,
    tool.description,
    tool.id,
    SECTION_NAMES.get(tool.section) ?? "",
    ...tool.keywords,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Case-insensitive, whitespace-split, AND across terms. Typing "gen ssh"
 * narrows rather than widens, which is what a filter box should do.
 */
export function filterTools(tools: Tool[], query: string): Tool[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return tools;

  return tools.filter((tool) => {
    const text = haystack(tool);
    return terms.every((term) => text.includes(term));
  });
}
