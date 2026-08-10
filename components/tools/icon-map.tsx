import {
  Braces,
  Clock,
  FileBadge,
  Fingerprint,
  Globe,
  KeyRound,
  KeySquare,
  Network,
  Terminal,
  TextQuote,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Resolves the string icon keys in lib/tools/registry.ts to components.
 *
 * This mapping lives here rather than in the registry so that the API route
 * handlers, which import the registry, never pull lucide into a server bundle.
 */
const ICONS: Record<string, LucideIcon> = {
  braces: Braces,
  clock: Clock,
  "file-badge": FileBadge,
  fingerprint: Fingerprint,
  globe: Globe,
  "key-round": KeyRound,
  "key-square": KeySquare,
  network: Network,
  terminal: Terminal,
  "text-quote": TextQuote,
};

/**
 * Exposed as a component rather than a `getIcon()` that callers invoke during
 * render — the latter looks like component creation on every render to both
 * React's lint rules and a reader.
 */
export function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Wrench;
  return <Icon className={className} aria-hidden />;
}
