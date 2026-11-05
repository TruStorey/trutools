/**
 * One good and one bad call per tool, through the real MCP path.
 *
 *   pnpm dlx tsx --test lib/mcp/server.test.ts
 *
 * The bad calls are the point. tools/list leaves ranges and formats out to
 * save tokens, on the promise that the error tells a model how to fix the
 * call, so each one asserts on the fix and not merely on isError.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { TOOLS } from "@/lib/tools/registry";

import { DEFINITIONS } from "./definitions";
import { mcpToolName } from "./names";
import { mcpTools, serveMcp } from "./server";

const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
const SSH_KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP6NwpPpOJiPDVTVTSq0yJ0tIEzq7scNqjV6kj3CHzo5 fixture";
const CERT = "-----BEGIN CERTIFICATE-----\nMIIBRDCB96ADAgECAhRr9ExxC2v1Ik5BOR+Q6qEJ6S1jQTAFBgMrZXAwFzEVMBMG\nA1UEAwwMZml4dHVyZS50ZXN0MCAXDTI2MTEwNTE4MDA1MloYDzIxMjYxMDEyMTgw\nMDUyWjAXMRUwEwYDVQQDDAxmaXh0dXJlLnRlc3QwKjAFBgMrZXADIQCWvPN+6P4U\nXFXFsmx86dVeCYHdC2HA1ZxJnNt2otszvaNTMFEwHQYDVR0OBBYEFJwach3gtaX6\nKVSUZeuRYQCzq78CMB8GA1UdIwQYMBaAFJwach3gtaX6KVSUZeuRYQCzq78CMA8G\nA1UdEwEB/wQFMAMBAf8wBQYDK2VwA0EAJ8dDeAxon5S07m79Ie/SEyWZsEFI4Cq0\n7L5C6mQEZD7T1FozMSEVk4HuTigdd5z7U8ANrwYbdSQGsuTh/rmcAw==\n-----END CERTIFICATE-----";

type Args = Record<string, unknown>;
type Case = { valid: Args; expect: RegExp; invalid: Args; error: RegExp };

const CASES: Record<string, Case> = {
  generate_password: {
    valid: { length: 32, symbols: false },
    expect: /^[A-Za-z0-9]{32}$/,
    invalid: { length: 2 },
    error: /length must be between 4 and 256/,
  },
  generate_uuid: {
    valid: { version: 7, uppercase: true },
    expect: /^[0-9A-F]{8}-[0-9A-F]{4}-7/,
    invalid: { count: 0 },
    error: /count must be between 1 and 1000/,
  },
  generate_token: {
    valid: { bytes: 16, encoding: "hex", prefix: "sk" },
    expect: /^sk_[0-9a-f]{32}$/,
    invalid: { encoding: "base32" },
    error: /encoding must be one of base64url, hex, base58/,
  },
  generate_hash: {
    valid: { body: "hello world", algo: "sha256" },
    expect: /b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9/,
    invalid: { body: "x", algo: "sha3" },
    error: /algo must be one of md5, sha1, sha256, sha512/,
  },
  decode_jwt: {
    valid: { token: JWT },
    expect: /HS256/,
    invalid: { token: "not-a-jwt" },
    error: /three|parts|segments/i,
  },
  inspect_ssh_key: {
    valid: { body: SSH_KEY },
    expect: /ed25519/i,
    invalid: { body: "ssh-nope AAAA" },
    error: /expected a line like: ssh-ed25519 AAAA/,
  },
  generate_ssh_key: {
    valid: { type: "ed25519", comment: "test" },
    expect: /BEGIN OPENSSH PRIVATE KEY/,
    invalid: { type: "dsa" },
    error: /type must be one of ed25519, rsa/,
  },
  inspect_cert: {
    valid: { body: CERT },
    expect: /fixture\.test/,
    invalid: { body: "not a certificate" },
    error: /PEM|certificate/,
  },
  inspect_subnet: {
    valid: { cidr: "10.0.0.0/22" },
    expect: /10\.0\.3\.255/,
    invalid: { cidr: "10.0.0.0/99" },
    error: /prefix must be between 0 and 32/,
  },
  calc_subnet_split: {
    valid: { cidr: "10.0.0.0/16", count: 4 },
    expect: /10\.0\.192\.0\/18/,
    invalid: { cidr: "10.0.0.0/16", count: 4, prefix: 20 },
    error: /give only one of count or prefix/,
  },
  calc_subnet_plan: {
    valid: { cidr: "10.0.0.0/16", need: "pods:4000,dmz:/26" },
    expect: /pods/,
    invalid: { cidr: "10.0.0.0/16", need: "pods:" },
    error: /give a host count or a \/prefix/,
  },
  lookup_dns: {
    valid: { name: "example.com", type: "A" },
    expect: /192\.0\.2\.1/,
    invalid: { name: "example.com", type: "BOGUS" },
    error: /type must be one of A, AAAA/,
  },
  lookup_mail: {
    valid: { domain: "example.com" },
    expect: /spf/i,
    invalid: { domain: "not a domain" },
    error: /is not a hostname/,
  },
  calc_bandwidth: {
    valid: { rate: 1, unit: "Gbps", size: 1, sizeUnit: "GiB" },
    expect: /MB\/s/,
    invalid: { rate: 1, unit: "furlongs" },
    error: /unknown rate unit "furlongs" — try /,
  },
  convert_base64: {
    valid: { body: "aGVsbG8=", mode: "decode" },
    expect: /hello/,
    invalid: { body: "%%%", mode: "decode" },
    error: /not valid base64/,
  },
  convert_bytes: {
    valid: { value: 1.5, from: "GB", to: "MB" },
    expect: /1,500/,
    invalid: { value: "x", from: "GB" },
    error: /value must be a number, got "x"/,
  },
  convert_yaml_json: {
    valid: { body: "a: 1", to: "json" },
    expect: /"a": 1/,
    invalid: { body: "a: 1", indent: 9 },
    error: /indent must be between 0 and 8/,
  },
  convert_duration: {
    valid: { value: "1h30m" },
    expect: /5,?400/,
    invalid: { value: "soon" },
    error: /try 90s, 1h30m or PT1H30M/,
  },
  convert_timestamp: {
    valid: { value: 1754870400, tz: "UTC" },
    expect: /2025-08-11/,
    invalid: { value: "now", tz: "Mars/Base" },
    error: /unknown timezone "Mars\/Base"/,
  },
  format_json: {
    valid: { body: '{"b":1,"a":2}', indent: 0, sort: true },
    expect: /^\{"a":2,"b":1\}$/,
    invalid: { body: "{oops" },
    error: /JSON|parse/i,
  },
  convert_case: {
    valid: { text: "hello world", to: "snake" },
    expect: /hello_world/,
    invalid: { text: "hello", to: "shouty" },
    error: /to must be one of camel/,
  },
  generate_lorem: {
    valid: { unit: "words", count: 5 },
    expect: /\w+/,
    invalid: { unit: "words", count: 5000 },
    error: /count must be 2000 or fewer words/,
  },
  transform_text: {
    valid: { body: "a\nb", op: "join", sep: "," },
    expect: /^a,b$/,
    invalid: { body: "a", op: "shuffle" },
    error: /op must be one of join, split/,
  },
  calc_disk_space: {
    valid: { capacity: "100TB", used: "40TB" },
    expect: /60/,
    invalid: { capacity: "100TB" },
    error: /give two of capacity, used and percent/,
  },
  convert_permissions: {
    valid: { mode: 755 },
    expect: /rwxr-xr-x/,
    invalid: { mode: "999" },
    error: /octal|digits/i,
  },
  lint_systemd: {
    valid: { body: "[Unit]\nDescription=x\n\n[Service]\nExecStart=/bin/true" },
    expect: /\S/,
    invalid: { body: "   " },
    error: /body is required/,
  },
  explain_cron: {
    valid: { expr: "0 3 * * 1", count: 2 },
    expect: /03:00|3:00/,
    invalid: { expr: "0 3 * *" },
    error: /expected 5 fields, got 4/,
  },
};

async function rpc(method: string, params?: unknown) {
  const response = await serveMcp(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );
  return (await response.json()).result;
}

async function call(name: string, args: Args) {
  const result = await rpc("tools/call", { name, arguments: args });
  return { isError: Boolean(result.isError), text: result.content[0].text as string };
}

/** Answers lookups from memory, so the suite needs no network. */
before(() => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const name = url.searchParams.get("name") ?? "";
    const isA = url.searchParams.get("type") === "A";
    const data = name.startsWith("_dmarc") ? '"v=DMARC1; p=none"' : '"v=spf1 -all"';
    return Response.json({
      Status: 0,
      AD: false,
      Answer: [{ name, type: isA ? 1 : 16, TTL: 60, data: isA ? "192.0.2.1" : data }],
    });
  }) as typeof fetch;
});

describe("tools/list", () => {
  it("has a definition and test case for every tool, under a sane size", async () => {
    const { tools } = await rpc("tools/list");
    assert.deepEqual(tools.map((tool: { name: string }) => tool.name).sort(), Object.keys(CASES).sort());
    for (const tool of tools) {
      assert.ok(tool.description.length <= 100, `${tool.name} description`);
      assert.ok(JSON.stringify(tool.inputSchema).length <= 400, `${tool.name} schema`);
      assert.ok(!("$schema" in tool.inputSchema), `${tool.name} $schema`);
    }
    for (const tool of mcpTools()) assert.ok(DEFINITIONS[tool.id], `${tool.id} definition`);
  });

  it("advertises exactly the registry's parameters, with the same required set", async () => {
    const { tools } = await rpc("tools/list");
    for (const tool of mcpTools()) {
      const { inputSchema } = tools.find((entry: { name: string }) => entry.name === mcpToolName(tool));
      const params = tool.api.params;
      assert.deepEqual(Object.keys(inputSchema.properties).sort(), params.map((p) => p.name).sort());
      assert.deepEqual(
        inputSchema.required ?? [],
        params.filter((p) => p.required).map((p) => p.name),
        tool.id,
      );
      for (const name of Object.keys(DEFINITIONS[tool.id].params)) {
        assert.ok(name in inputSchema.properties, `${tool.id} defines unknown param ${name}`);
      }
    }
  });

  it("keeps the hints clients act on", async () => {
    const { tools } = await rpc("tools/list");
    const dns = tools.find((tool: { name: string }) => tool.name === "lookup_dns");
    assert.equal(dns.title, "DNS Lookup");
    assert.deepEqual(dns.annotations, { readOnlyHint: true, openWorldHint: true });
  });

  it("only advertises enum values the handler accepts", async () => {
    const { tools } = await rpc("tools/list");
    for (const tool of mcpTools()) {
      const name = mcpToolName(tool);
      const { properties } = tools.find((entry: { name: string }) => entry.name === name).inputSchema;
      for (const [param, spec] of Object.entries<{ enum?: unknown[] }>(properties)) {
        for (const value of spec.enum ?? []) {
          const { isError, text } = await call(name, { ...CASES[name].valid, [param]: value });
          assert.ok(!isError, `${name} ${param}=${value}: ${text}`);
        }
      }
    }
  });
});

describe("tools/call", () => {
  for (const [name, testCase] of Object.entries(CASES)) {
    it(`${name}: valid call`, async () => {
      const { isError, text } = await call(name, testCase.valid);
      assert.ok(!isError, text);
      assert.match(text, testCase.expect);
    });

    it(`${name}: invalid call says how to fix it`, async () => {
      const { isError, text } = await call(name, testCase.invalid);
      assert.ok(isError, text);
      assert.match(text, testCase.error);
    });
  }

  it("names a missing required argument and what it wants", async () => {
    for (const tool of mcpTools()) {
      for (const param of tool.api.params.filter(({ required }) => required)) {
        const args = { ...CASES[mcpToolName(tool)].valid };
        delete args[param.name];
        const { isError, text } = await call(mcpToolName(tool), args);
        assert.ok(isError, `${tool.id} without ${param.name}`);
        assert.match(text, new RegExp(`${param.name} is required`));
        assert.doesNotMatch(text, /curl/);
      }
    }
  });

  it("rejects non-scalar arguments, and accepts all three scalar forms", async () => {
    const bad = await call("generate_password", { length: [32] });
    assert.ok(bad.isError);
    assert.match(bad.text, /length must be a string, number or boolean\. 4 to 256/);

    for (const length of [8, "8"]) {
      assert.equal((await call("generate_password", { length, count: 1 })).text.length, 8);
    }
    assert.match((await call("generate_password", { length: 8, symbols: "false" })).text, /^\w{8}$/);
    assert.match((await call("generate_password", { length: 8, symbols: false })).text, /^\w{8}$/);
  });

  it("does not list the ip tool", () => {
    assert.ok(TOOLS.some((tool) => tool.id === "ip"));
    assert.ok(!mcpTools().some((tool) => tool.id === "ip"));
  });
});
