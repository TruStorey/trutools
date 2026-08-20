"use client";

import { Check, Copy, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Field, TextControl } from "@/components/tools/controls";
import { ToolOutput } from "@/components/tools/tool-output";
import { useToolRun } from "@/components/tools/use-tool-run";
import { useIsland } from "@/components/island/island-provider";
import { Button } from "@/components/ui/button";
import { planSubnets } from "@/lib/tools/impl/subnet-plan";
import { API_BASE } from "@/lib/tools/snippets";

/**
 * Requirements in, an allocation out — the same `planSubnets` the API calls, so
 * the browser and `curl` cannot drift.
 *
 * The whole panel state is exactly the `need=` string, which is why the copied
 * curl command reproduces what is on screen rather than approximating it.
 */

/** `id` is React's key only. Rows are added and removed, so an index would let
 *  a deleted row hand its DOM node — and the focus in it — to its neighbour. */
type Requirement = { id: number; name: string; size: string };

let nextId = 0;
const row = (name: string, size: string): Requirement => ({ id: (nextId += 1), name, size });

const STARTING_POINT: Requirement[] = [
  row("pods", "4000"),
  row("mgmt", "200"),
  row("dmz", "/26"),
];

function toNeed(requirements: Requirement[]): string {
  return requirements
    .filter((requirement) => requirement.size.trim())
    .map((requirement) =>
      requirement.name.trim()
        ? `${requirement.name.trim()}:${requirement.size.trim()}`
        : requirement.size.trim(),
    )
    .join(",");
}

export function SubnetPlannerPanel() {
  const { notify } = useIsland();
  const [cidr, setCidr] = useState("10.0.0.0/16");
  const [requirements, setRequirements] = useState<Requirement[]>(STARTING_POINT);
  const [copied, setCopied] = useState(false);
  const { result, error, run } = useToolRun();

  const need = useMemo(() => toNeed(requirements), [requirements]);

  // Instant maths, no request behind it, so debouncing would only add lag.
  useEffect(() => {
    if (!cidr.trim() || !need) return;
    run(() => planSubnets({ cidr, need }));
  }, [cidr, need, run]);

  function update(id: number, change: Partial<Requirement>) {
    setRequirements((current) =>
      current.map((requirement) =>
        requirement.id === id ? { ...requirement, ...change } : requirement,
      ),
    );
  }

  const curl = `curl '${API_BASE}/subnet-planner?cidr=${cidr}&need=${need}'`;

  async function copyCurl() {
    try {
      await navigator.clipboard.writeText(curl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      notify({ variant: "success", title: "Copied curl command", description: "Subnet Planner" });
    } catch {
      notify({ variant: "error", title: "Could not copy" });
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Block to plan inside" hint="IPv4 or IPv6">
        <TextControl
          value={cidr}
          onChange={(event) => setCidr(event.target.value)}
          placeholder="10.0.0.0/16"
          autoComplete="off"
        />
      </Field>

      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">
          Subnets needed
          <span className="ml-1 text-muted-foreground/60">
            a host count, or an explicit /prefix
          </span>
        </span>

        {requirements.map((requirement, index) => (
          <div key={requirement.id} className="flex items-center gap-2">
            <TextControl
              value={requirement.name}
              onChange={(event) => update(requirement.id, { name: event.target.value })}
              placeholder="name"
              aria-label={`Name of subnet ${index + 1}`}
              autoComplete="off"
              className="flex-1"
            />
            <TextControl
              value={requirement.size}
              onChange={(event) => update(requirement.id, { size: event.target.value })}
              placeholder="200 or /26"
              aria-label={`Size of subnet ${index + 1}`}
              autoComplete="off"
              className="w-28"
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Remove subnet ${index + 1}`}
              disabled={requirements.length === 1}
              onClick={() =>
                setRequirements((current) =>
                  current.filter((candidate) => candidate.id !== requirement.id),
                )
              }
            >
              <X />
            </Button>
          </div>
        ))}

        <Button
          size="sm"
          variant="secondary"
          onClick={() => setRequirements((current) => [...current, row("", "")])}
        >
          <Plus />
          Add subnet
        </Button>
      </div>

      <ToolOutput result={result} error={error} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <code className="font-mono">need={need || "…"}</code>
        <Button variant="ghost" size="xs" onClick={copyCurl} disabled={!need}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy as curl"}
        </Button>
      </div>
    </div>
  );
}
