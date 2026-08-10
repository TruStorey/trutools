import { ToolGrid } from "@/components/tools/tool-grid";
import { SECTIONS, TOOLS } from "@/lib/tools/registry";

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto mb-10 max-w-2xl space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          TruTools - click it or curl it
        </h1>
        <p className="text-muted-foreground">
          A collection of tools to make the fiddly stuff less, well fiddly. All tools are available in the Browser or via the API. No account needed.{" "}
        </p>
      </div>

      <ToolGrid tools={TOOLS} sections={SECTIONS} />
    </div>
  );
}
