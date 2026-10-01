import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ToolGrid } from "@/components/tools/tool-grid";
import { getVerb, isVerb, SECTIONS, toolsForVerb, VERBS } from "@/lib/tools/registry";

/**
 * What a browser gets at /<verb>; curl gets the text list via proxy.ts.
 *
 * A root-level dynamic segment, kept from swallowing every other path by
 * dynamicParams = false: anything not returned below is the normal 404.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return VERBS.map((verb) => ({ verb: verb.id }));
}

type PageProps = {
  params: Promise<{ verb: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { verb } = await params;
  const found = isVerb(verb) ? getVerb(verb) : undefined;
  if (!found) return {};
  return { title: `/${found.id}`, description: found.description };
}

export default async function VerbPage({ params }: PageProps) {
  const { verb } = await params;
  const found = isVerb(verb) ? getVerb(verb) : undefined;
  if (!found) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto mb-10 max-w-2xl space-y-3 text-center">
        <h1 className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
          /{found.id}
        </h1>
        <p className="text-muted-foreground">{found.description}</p>
        <p className="text-sm">
          <Link href="/" className="text-muted-foreground underline-offset-4 hover:underline">
            All tools
          </Link>
        </p>
      </div>

      <ToolGrid
        tools={toolsForVerb(found.id)}
        sections={SECTIONS}
        verbs={VERBS}
        showGroupToggle={false}
      />
    </div>
  );
}
