import { ToolGrid } from "@/components/tools/tool-grid";
import { SECTIONS, TOOLS } from "@/lib/tools/registry";
import { SITE_HOST } from "@/lib/site";

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto mb-10 max-w-2xl space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Simple tools, in the browser or over an API.
        </h1>
        <p className="text-muted-foreground">
          Passwords, keys, subnets, timestamps, text. Open a card to use it here, or
          skip the page entirely — every tool answers on a URL of its own.{" "}
          <code className="rounded bg-foreground/8 px-1.5 py-0.5 font-mono text-[0.85em]">
            curl {SITE_HOST}/uuid-generator
          </code>
        </p>
      </div>

      <ToolGrid tools={TOOLS} sections={SECTIONS} />
    </div>
  );
}
