import {
  BadgeCheck,
  Binary,
  Braces,
  CalendarClock,
  CaseSensitive,
  Clock,
  FileBadge,
  FileCode,
  FileKey,
  FileLock,
  Fingerprint,
  HardDrive,
  Hash,
  Gauge,
  Globe,
  KeyRound,
  Hourglass,
  KeySquare,
  ListTree,
  MailCheck,
  Network,
  Pilcrow,
  RadioTower,
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
  "calendar-clock": CalendarClock,
  "case-sensitive": CaseSensitive,
  clock: Clock,
  "file-badge": FileBadge,
  "file-code": FileCode,
  "file-key": FileKey,
  "file-lock": FileLock,
  fingerprint: Fingerprint,
  gauge: Gauge,
  globe: Globe,
  "hard-drive": HardDrive,
  hash: Hash,
  hourglass: Hourglass,
  "key-round": KeyRound,
  "key-square": KeySquare,
  "list-tree": ListTree,
  "mail-check": MailCheck,
  network: Network,
  pilcrow: Pilcrow,
  "radio-tower": RadioTower,
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
