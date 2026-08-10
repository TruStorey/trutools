"use client";

import type { ComponentType } from "react";

import {
  PasswordPanel,
  TokenPanel,
  UuidPanel,
} from "./crypto-panels";
import { JsonPanel, SubnetPanel, TextPanel, TimestampPanel } from "./data-panels";
import { SubnetSplitterPanel } from "./subnet-splitter-panel";
import { CertReaderPanel, IpPanel, SshKeypairPanel } from "./server-panels";

/** Interactive panels, keyed by the tool id in lib/tools/registry.ts. */
const PANELS: Record<string, ComponentType> = {
  "password-generator": PasswordPanel,
  "uuid-generator": UuidPanel,
  "token-generator": TokenPanel,
  "ssh-keypair-generator": SshKeypairPanel,
  "cert-reader": CertReaderPanel,
  "subnet-calculator": SubnetPanel,
  "subnet-splitter": SubnetSplitterPanel,
  ip: IpPanel,
  "timestamp-converter": TimestampPanel,
  "json-beautify": JsonPanel,
  "text-tool": TextPanel,
};

export function ToolPanelFor({ id }: { id: string }) {
  const Panel = PANELS[id];

  if (!Panel) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
        No interactive panel for this tool yet — the API tab still works.
      </p>
    );
  }

  return <Panel />;
}
