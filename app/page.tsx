import { ToolGrid } from "@/components/tools/tool-grid";
import { SECTIONS, TOOLS } from "@/lib/tools/registry";
import { SITE_HOST } from "@/lib/site";

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-10 max-w-2xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Simple tools for people who live in a terminal.
        </h1>
        <p className="text-muted-foreground">
          Generate a key, work out a subnet, make some JSON readable. Every tool is
          also a plain-text endpoint, so you can skip the browser entirely —{" "}
          <code className="rounded bg-foreground/8 px-1.5 py-0.5 font-mono text-[0.85em]">
            curl {SITE_HOST}/api/v1/ip
          </code>
        </p>
      </div>

      <ToolGrid tools={TOOLS} sections={SECTIONS} />
    </div>
  );
}
