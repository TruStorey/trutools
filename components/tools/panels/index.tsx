"use client";

import type { ComponentType } from "react";

import {
  PasswordPanel,
  TokenPanel,
  UuidPanel,
  SshKeyInspectPanel,
} from "./crypto-panels";
import { DurationPanel, JsonPanel, SubnetPanel, TextPanel, TimestampPanel } from "./data-panels";
import { SubnetSplitterPanel } from "./subnet-splitter-panel";
import { SubnetPlannerPanel } from "./subnet-planner-panel";
import { DnsPanel } from "./dns-panel";
import { MailPanel } from "./mail-panel";
import { BandwidthPanel } from "./network-panels";
import {
  Base64Panel,
  BytesPanel,
  DiskSpacePanel,
  HashPanel,
  JwtPanel,
  YamlJsonPanel,
} from "./encoding-panels";
import {
  CasePanel,
  CronPanel,
  LoremPanel,
  PermissionsPanel,
  SystemdPanel,
} from "./system-panels";
import { CertReaderPanel, IpPanel, SshKeypairPanel } from "./server-panels";

/** Interactive panels, keyed by the tool id in lib/tools/registry.ts. */
const PANELS: Record<string, ComponentType> = {
  "password-generator": PasswordPanel,
  "uuid-generator": UuidPanel,
  "token-generator": TokenPanel,
  "ssh-keypair-generator": SshKeypairPanel,
  "cert-reader": CertReaderPanel,
  "subnet-inspector": SubnetPanel,
  "subnet-splitter": SubnetSplitterPanel,
  "subnet-planner": SubnetPlannerPanel,
  ip: IpPanel,
  "dns-lookup": DnsPanel,
  "mail-check": MailPanel,
  "timestamp-converter": TimestampPanel,
  "json-beautify": JsonPanel,
  "text-tool": TextPanel,
  base64: Base64Panel,
  "hash-generator": HashPanel,
  "jwt-decoder": JwtPanel,
  "bytes-converter": BytesPanel,
  "disk-space": DiskSpacePanel,
  "yaml-json": YamlJsonPanel,
  "case-converter": CasePanel,
  "lorem-ipsum": LoremPanel,
  "file-permissions": PermissionsPanel,
  "systemd-lint": SystemdPanel,
  "cron-explain": CronPanel,
  bandwidth: BandwidthPanel,
  duration: DurationPanel,
  "ssh-key-inspect": SshKeyInspectPanel,
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
