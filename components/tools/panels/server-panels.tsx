"use client";

import { KeyRound, LoaderCircle, RefreshCw, ScanLine } from "lucide-react";
import { useEffect, useState } from "react";

import { Field, Segmented, TextAreaControl, TextControl } from "@/components/tools/controls";
import { ToolOutput } from "@/components/tools/tool-output";
import { useToolRun } from "@/components/tools/use-tool-run";
import { Button } from "@/components/ui/button";
import type { SshKeyType } from "@/lib/tools/impl/server/ssh";

/**
 * Panels for the tools that cannot run in the browser.
 *
 * OpenSSH key encoding and X.509 parsing both need node:crypto, so these call
 * our own public API. That is not a compromise — it means the browser sees
 * byte-for-byte what a `curl` user sees.
 */

export function SshKeypairPanel() {
  const [type, setType] = useState<SshKeyType>("ed25519");
  const [bits, setBits] = useState(4096);
  const [comment, setComment] = useState("");
  const { result, error, pending, runRemote } = useToolRun();

  function generate() {
    const params = new URLSearchParams({ type });
    if (type === "rsa") params.set("bits", String(bits));
    if (comment.trim()) params.set("comment", comment.trim());
    void runRemote(`/api/v1/ssh-keypair-generator?${params}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Segmented
          label="Key type"
          value={type}
          onChange={setType}
          options={[
            { value: "ed25519", label: "ed25519" },
            { value: "rsa", label: "RSA" },
          ]}
        />
        {type === "rsa" ? (
          <Segmented
            label="Modulus"
            value={bits}
            onChange={setBits}
            options={[
              { value: 2048, label: "2048" },
              { value: 3072, label: "3072" },
              { value: 4096, label: "4096" },
            ]}
          />
        ) : null}
      </div>

      <Field label="Comment" hint="optional">
        <TextControl
          placeholder="you@laptop"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={generate} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
          {pending ? "Generating…" : "Generate keypair"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Generated on the server and never stored.
        </p>
      </div>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function CertReaderPanel() {
  const [pem, setPem] = useState("");
  const { result, error, pending, runRemote } = useToolRun();

  function read() {
    void runRemote("/api/v1/cert-reader", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: pem,
    });
  }

  return (
    <div className="space-y-4">
      <Field label="PEM certificate">
        <TextAreaControl
          value={pem}
          onChange={(event) => setPem(event.target.value)}
          placeholder={"-----BEGIN CERTIFICATE-----\nMIIC…\n-----END CERTIFICATE-----"}
        />
      </Field>

      <Button size="sm" variant="secondary" onClick={read} disabled={pending || !pem.trim()}>
        {pending ? <LoaderCircle className="animate-spin" /> : <ScanLine />}
        {pending ? "Reading…" : "Read certificate"}
      </Button>

      <ToolOutput result={result} error={error} />
    </div>
  );
}

export function IpPanel() {
  const { result, error, pending, runRemote } = useToolRun();

  // The whole tool is one value, so fetch it as soon as the card opens.
  useEffect(() => {
    void runRemote("/api/v1/ip");
  }, [runRemote]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        The address this request arrived from, as our edge sees it.
      </p>

      <Button
        size="sm"
        variant="secondary"
        onClick={() => void runRemote("/api/v1/ip")}
        disabled={pending}
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
        Refresh
      </Button>

      <ToolOutput result={result} error={error} />
    </div>
  );
}
