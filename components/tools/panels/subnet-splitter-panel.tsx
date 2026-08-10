"use client";

import { Check, Copy, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { Field, TextControl } from "@/components/tools/controls";
import { useIsland } from "@/components/island/island-provider";
import { Button } from "@/components/ui/button";
import {
  blockSize,
  classifyIpv4,
  maskFor,
  parseCidr,
  usableRange,
  type Family,
} from "@/lib/tools/impl/ip";
import {
  serialiseTree,
  type Node,
} from "@/lib/tools/impl/subnet-split";
import { API_BASE } from "@/lib/tools/snippets";
import { cn } from "@/lib/utils";

/**
 * A port of Dave's Visual Subnet Calculator: divide any row in half, join a
 * divided pair back together.
 *
 * The address maths comes from the same helpers the API handler uses
 * (`leaves`-style traversal, `usableRange`, `maskFor`), so the numbers here and
 * the numbers from curl cannot drift. Only the presentation differs, because
 * the table needs buttons hanging off each row.
 */

type Row = {
  network: bigint;
  prefix: number;
  /** Which child to take at each level, from the root. */
  path: number[];
  /** Set on the first row of a pair that can be joined back up. */
  joinAt: number[] | null;
};

function buildRows(
  node: Node,
  network: bigint,
  prefix: number,
  family: Family,
  path: number[],
): Row[] {
  if (!node.children) return [{ network, prefix, path, joinAt: null }];

  const half = blockSize(family, prefix + 1);
  const left = buildRows(node.children[0], network, prefix + 1, family, [...path, 0]);
  const right = buildRows(node.children[1], network + half, prefix + 1, family, [...path, 1]);

  // A node is joinable only when both halves are still whole. Anything deeper
  // has to be joined from the bottom up, exactly as the original does.
  if (!node.children[0].children && !node.children[1].children) {
    left[0] = { ...left[0], joinAt: path };
  }

  return [...left, ...right];
}

/** Immutable update at a path, so React sees a new tree. */
function updateAt(node: Node, path: number[], change: (node: Node) => Node): Node {
  if (path.length === 0) return change(node);
  if (!node.children) return node;

  const [head, ...rest] = path;
  const children: [Node, Node] = [node.children[0], node.children[1]];
  children[head] = updateAt(children[head], rest, change);
  return { children };
}

export function SubnetSplitterPanel() {
  const { notify } = useIsland();
  const [cidr, setCidr] = useState("10.0.0.0/16");
  const [tree, setTree] = useState<Node>({});
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => {
    try {
      return { value: parseCidr(cidr), error: null as string | null };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : "invalid CIDR" };
    }
  }, [cidr]);

  const rows = useMemo(() => {
    if (!parsed.value) return [];
    const { network, prefix, family } = parsed.value;
    return buildRows(tree, network, prefix, family, []);
  }, [tree, parsed]);

  const divideString = serialiseTree(tree);
  const maxPrefix = parsed.value?.family.size ?? 32;
  const isV6 = parsed.value?.isV6 ?? false;

  function reset(next?: string) {
    if (next !== undefined) setCidr(next);
    setTree({});
  }

  const curl = `curl '${API_BASE}/subnet-splitter?cidr=${cidr}&divide=${divideString}'`;

  async function copyCurl() {
    try {
      await navigator.clipboard.writeText(curl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      notify({ variant: "success", title: "Copied curl command", description: "Subnet Splitter" });
    } catch {
      notify({ variant: "error", title: "Could not copy" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Block to split" hint="IPv4 or IPv6" className="min-w-56 flex-1">
          <TextControl
            value={cidr}
            onChange={(event) => reset(event.target.value)}
            placeholder="10.0.0.0/16"
            autoComplete="off"
          />
        </Field>
        <Button size="sm" variant="secondary" onClick={() => reset()} disabled={!tree.children}>
          <RotateCcw />
          Reset
        </Button>
      </div>

      {parsed.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive"
        >
          {parsed.error}
        </p>
      ) : null}

      {parsed.value ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/15 backdrop-blur-sm dark:bg-black/25">
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground">
                  <th scope="col" className="px-3 py-2 text-left font-medium">Subnet</th>
                  {!isV6 ? (
                    <th scope="col" className="px-3 py-2 text-left font-medium">Netmask</th>
                  ) : null}
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    {isV6 ? "Range" : "Usable range"}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {isV6 ? "Addresses" : "Hosts"}
                  </th>
                  {!isV6 ? (
                    <th scope="col" className="px-3 py-2 text-left font-medium">Type</th>
                  ) : null}
                  <th scope="col" className="px-3 py-2 text-right font-medium">Divide</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const { family, format } = parsed.value!;
                  const size = blockSize(family, row.prefix);
                  const usable = usableRange(row.network, row.prefix, family);
                  const last = row.network + size - 1n;
                  const canDivide = row.prefix < maxPrefix;

                  return (
                    <tr key={row.path.join("") || "root"} className="border-b border-white/5 last:border-0">
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {format(row.network)}/{row.prefix}
                      </td>
                      {!isV6 ? (
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                          {format(maskFor(family, row.prefix))}
                        </td>
                      ) : null}
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {isV6
                          ? `${format(row.network)} - ${format(last)}`
                          : `${format(usable.first)} - ${format(usable.last)}`}
                      </td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        {(isV6 ? size : usable.count).toLocaleString("en-US")}
                      </td>
                      {!isV6 ? (
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                          {classifyIpv4(row.network, row.prefix)}
                        </td>
                      ) : null}
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <span className="inline-flex gap-1">
                          {row.joinAt ? (
                            <button
                              type="button"
                              onClick={() =>
                                setTree((current) =>
                                  updateAt(current, row.joinAt!, () => ({})),
                                )
                              }
                              className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[0.7rem] transition-colors hover:bg-white/15 dark:bg-black/20"
                            >
                              Join
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={!canDivide}
                            onClick={() =>
                              setTree((current) =>
                                updateAt(current, row.path, () => ({
                                  children: [{}, {}],
                                })),
                              )
                            }
                            className={cn(
                              "rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[0.7rem] transition-colors hover:bg-white/15 dark:bg-black/20",
                              !canDivide && "cursor-not-allowed opacity-40 hover:bg-white/5",
                            )}
                            title={canDivide ? undefined : `/${maxPrefix} cannot be divided further`}
                          >
                            Divide
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {rows.length} subnet{rows.length === 1 ? "" : "s"} ·{" "}
              <code className="font-mono">divide={divideString}</code>
            </span>
            <Button variant="ghost" size="xs" onClick={copyCurl}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy as curl"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
