"use client";

import {
  Bot,
  Check,
  Code as CodeIcon,
  Copy,
  ExternalLink,
  MessageSquare,
  MessagesSquare,
  MousePointer2,
  SquareTerminal,
  Terminal,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { useIsland } from "@/components/island/island-provider";
import { CodeBlock } from "@/components/tools/code-block";
import { PillGroup } from "@/components/tools/pill-group";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { describeWindow } from "@/lib/api/rate-limit-config";
import { glassVariantStyles } from "@/lib/glass-variants";
import { isMcpTool, MCP_URL, mcpToolName } from "@/lib/mcp/names";
import { TOOLS } from "@/lib/tools/registry";
import type { SnippetLanguage } from "@/lib/tools/snippets";
import { cn } from "@/lib/utils";

type McpDialogProps = {
  /** Server-rendered fallback; refreshed from /api/health when opened. */
  rateLimit: { max: number; window: string };
};

type ClientId =
  | "claude"
  | "chatgpt"
  | "claude-code"
  | "codex"
  | "gemini-cli"
  | "cursor"
  | "vscode";

type ClientSetup = {
  label: string;
  icon: ReactNode;
  /** Chat apps take the URL in a settings screen; coding tools take config. */
  group: "chat" | "code";
  /** Where the snippet goes, or the steps when there is no snippet. */
  where: ReactNode;
  /** `curl` highlights shell, `javascript` is close enough for JSON and TOML. */
  snippet?: { code: string; language: SnippetLanguage };
};

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** Bold for the labels a person has to find on screen. */
function Ui({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-foreground/85">{children}</strong>;
}

const ICON = "size-3.5";

/** One step per line, numbered, rather than a paragraph of arrows. */
function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-4 marker:text-foreground/50">{children}</ol>;
}

const CLIENTS: Record<ClientId, ClientSetup> = {
  claude: {
    label: "Claude",
    icon: <MessageSquare className={ICON} aria-hidden />,
    group: "chat",
    where: (
      <Steps>
        <li>On claude.ai or the desktop app, open <Ui>Settings</Ui> → <Ui>Connectors</Ui>.</li>
        <li>
          Choose <Ui>Add custom connector</Ui> and name it trutools.
        </li>
        <li>Paste the endpoint URL above, and leave authentication empty.</li>
      </Steps>
    ),
  },
  chatgpt: {
    label: "ChatGPT",
    icon: <MessagesSquare className={ICON} aria-hidden />,
    group: "chat",
    where: (
      <Steps>
        <li>
          On chatgpt.com, open <Ui>Settings</Ui> → <Ui>Apps &amp; Connectors</Ui> →{" "}
          <Ui>Advanced settings</Ui>.
        </li>
        <li>
          Turn on <Ui>Developer mode</Ui>. It needs a paid plan.
        </li>
        <li>
          Choose <Ui>Create</Ui>, name it trutools, paste the endpoint URL above, and pick{" "}
          <Ui>No authentication</Ui>.
        </li>
        <li>In a chat, turn trutools on from the tools menu.</li>
      </Steps>
    ),
  },
  "claude-code": {
    label: "Claude Code",
    icon: <Terminal className={ICON} aria-hidden />,
    group: "code",
    where: <>Run once in a terminal.</>,
    snippet: { code: `claude mcp add --transport http trutools ${MCP_URL}`, language: "curl" },
  },
  codex: {
    label: "Codex",
    icon: <SquareTerminal className={ICON} aria-hidden />,
    group: "code",
    where: (
      <>
        Run once in a terminal, or add <Code>[mcp_servers.trutools]</Code> with{" "}
        <Code>url = &quot;{MCP_URL}&quot;</Code> to <Code>~/.codex/config.toml</Code>.
      </>
    ),
    snippet: { code: `codex mcp add trutools --url ${MCP_URL}`, language: "curl" },
  },
  "gemini-cli": {
    label: "Gemini CLI",
    icon: <Terminal className={ICON} aria-hidden />,
    group: "code",
    where: (
      <>
        Run once in a terminal, or add it to <Code>~/.gemini/settings.json</Code> as{" "}
        <Code>{`"httpUrl": "${MCP_URL}"`}</Code> under <Code>mcpServers</Code>.
      </>
    ),
    snippet: { code: `gemini mcp add --transport http trutools ${MCP_URL}`, language: "curl" },
  },
  cursor: {
    label: "Cursor",
    icon: <MousePointer2 className={ICON} aria-hidden />,
    group: "code",
    where: <>Add to <Code>~/.cursor/mcp.json</Code>.</>,
    snippet: {
      code: json({ mcpServers: { trutools: { url: MCP_URL } } }),
      language: "javascript",
    },
  },
  vscode: {
    label: "VS Code",
    icon: <CodeIcon className={ICON} aria-hidden />,
    group: "code",
    where: <>Add to <Code>.vscode/mcp.json</Code> in your workspace.</>,
    snippet: {
      code: json({ servers: { trutools: { type: "http", url: MCP_URL } } }),
      language: "javascript",
    },
  },
};

const CLIENT_IDS = Object.keys(CLIENTS) as ClientId[];

const GROUPS = [
  { id: "chat", label: "Chat apps" },
  { id: "code", label: "Coding tools" },
] as const;

/** Same list tools/list returns: both read names from lib/mcp/names. */
const MCP_TOOL_NAMES = TOOLS.filter(isMcpTool).map(mcpToolName);

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-1.5", className)}>
      <h3 className="text-xs font-semibold tracking-wider text-foreground/70 uppercase">
        {title}
      </h3>
      <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.95em] text-foreground/85 dark:bg-black/30">
      {children}
    </code>
  );
}

/** A copy button pinned over a CodeBlock, matching the API tab's. */
function CopyButton({ text, title, label }: { text: string; title: string; label: string }) {
  const { notify } = useIsland();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      notify({ variant: "success", title });
    } catch {
      notify({ variant: "error", title: "Could not copy" });
    }
  }

  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={copy}
      aria-label={label}
      className="border border-white/10 bg-black/30 backdrop-blur-sm hover:bg-black/50"
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/**
 * Connecting an agent over MCP.
 *
 * Third of the navbar dialogs, beside <ApiInfoDialog> and <AboutDialog>, with
 * the same trigger and frosted panel. MCP is one endpoint for the whole site,
 * so it lives here rather than as a tab on every tool; each tool's API tab
 * only names its MCP tool.
 */
export function McpDialog({ rateLimit }: McpDialogProps) {
  const [limit, setLimit] = useState(rateLimit);
  const [client, setClient] = useState<ClientId>("claude");
  const setup = CLIENTS[client];

  // Same refresh as ApiInfoDialog: the prop was read at build time, and
  // /api/health advertises the live policy without counting against it.
  async function refreshLimit(open: boolean) {
    if (!open) return;
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const max = Number(response.headers.get("x-ratelimit-limit"));
      const windowSec = Number(response.headers.get("x-ratelimit-window"));
      if (Number.isFinite(max) && max > 0 && Number.isFinite(windowSec) && windowSec > 0) {
        setLimit({ max, window: describeWindow(windowSec) });
      }
    } catch {
      // Keep the server-rendered numbers.
    }
  }

  return (
    <Dialog onOpenChange={refreshLimit}>
      <DialogTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center rounded-lg px-2 py-1",
              "text-xs font-medium tracking-wide text-muted-foreground uppercase select-none",
              "transition-colors outline-none hover:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring/60",
            )}
          />
        }
      >
        MCP
      </DialogTrigger>

      {/* Same frosted overrides as ApiInfoDialog, for the same reason. */}
      <DialogContent
        className={cn(
          "max-h-[85vh] max-w-3xl overflow-y-auto rounded-2xl p-5 sm:max-w-3xl",
          glassVariantStyles.frosted,
          "dark:bg-black/[0.75]",
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bot className="size-4" aria-hidden />
            Connect an agent
          </DialogTitle>
          <DialogDescription className="text-xs">
            Every tool here is also an MCP tool. One URL, no key, no account.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <Section title="Endpoint">
            <CodeBlock
              code={MCP_URL}
              language="curl"
              action={
                <CopyButton text={MCP_URL} title="Copied MCP URL" label="Copy the MCP URL" />
              }
            />
            <p>Streamable HTTP, stateless. Any MCP client that speaks HTTP can use it.</p>
          </Section>

          <Section title="Set up">
            {/*
              Two groups, one choice: each group is a PillGroup over the same
              state, so a value from the other group simply selects nothing here.
            */}
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {GROUPS.map((group) => (
                <div key={group.id} className="space-y-1">
                  <span className="block text-[0.7rem] text-muted-foreground/70">{group.label}</span>
                  <PillGroup
                    label={`MCP client: ${group.label}`}
                    value={client}
                    onChange={setClient}
                    options={CLIENT_IDS.filter((id) => CLIENTS[id].group === group.id).map(
                      (id) => ({ value: id, label: CLIENTS[id].label, icon: CLIENTS[id].icon }),
                    )}
                  />
                </div>
              ))}
            </div>
            <div className="pt-1">{setup.where}</div>
            {setup.snippet ? (
              <CodeBlock
                code={setup.snippet.code}
                language={setup.snippet.language}
                action={
                  <CopyButton
                    text={setup.snippet.code}
                    title={`Copied ${setup.label} setup`}
                    label={`Copy the ${setup.label} setup`}
                  />
                }
              />
            ) : null}
          </Section>

          {/* Set apart from the setup above, which ends in a code block and runs into it otherwise. */}
          <Section title={`Tools · ${MCP_TOOL_NAMES.length}`} className="pt-4">
            <p>
              Named <Code>&lt;verb&gt;_&lt;tool&gt;</Code>. Arguments are the API&apos;s query
              parameters, and tools that take a document take it as <Code>body</Code>.
            </p>
            <div className="flex flex-wrap gap-1">
              {MCP_TOOL_NAMES.map((name) => (
                <Code key={name}>{name}</Code>
              ))}
            </div>
          </Section>

          <Section title="Rate limit">
            <p>
              <strong className="text-foreground/85">
                {limit.max} requests per {limit.window}, per IP
              </strong>
              , shared with the HTTP API. Every MCP message is one request, the{" "}
              <Code>initialize</Code> included.
            </p>
          </Section>
        </div>

        <a
          href="https://github.com/TruStorey/trutools/blob/main/docs/mcp.md"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none dark:bg-black/20 dark:hover:bg-black/30"
        >
          MCP docs
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </DialogContent>
    </Dialog>
  );
}
