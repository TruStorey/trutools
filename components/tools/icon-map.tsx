import {
  BadgeCheck,
  Binary,
  Braces,
  CaseSensitive,
  Clock,
  FileBadge,
  FileCode,
  Fingerprint,
  HardDrive,
  Hash,
  Globe,
  KeyRound,
  KeySquare,
  Network,
  Pilcrow,
  ServerCog,
  Shield,
  Split,
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
  "badge-check": BadgeCheck,
  binary: Binary,
  braces: Braces,
  "case-sensitive": CaseSensitive,
  clock: Clock,
  "file-badge": FileBadge,
  "file-code": FileCode,
  fingerprint: Fingerprint,
  globe: Globe,
  "hard-drive": HardDrive,
  hash: Hash,
  "key-round": KeyRound,
  "key-square": KeySquare,
  network: Network,
  pilcrow: Pilcrow,
  "server-cog": ServerCog,
  shield: Shield,
  split: Split,
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
