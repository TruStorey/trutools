import type { ApiFormat } from "./format";
import type { Tool } from "./registry";

export const API_BASE = "https://trutools.truvibe.dev/api/v1";

export const SNIPPET_LANGUAGES = [
  "curl",
  "powershell",
  "python",
  "javascript",
  "go",
] as const;

export type SnippetLanguage = (typeof SNIPPET_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SnippetLanguage, string> = {
  curl: "curl",
  powershell: "PowerShell",
  python: "Python",
  javascript: "JavaScript",
  go: "Go",
};

/**
 * Only curl gets a format picker. Every other language here parses JSON into a
 * native structure, which is the whole reason you would use them over curl —
 * offering them XML or plain text would just mean handing back a string.
 */
export function supportsFormatChoice(language: SnippetLanguage): boolean {
  return language === "curl";
}

function queryString(tool: Tool, format: ApiFormat): string {
  const params = new URLSearchParams(tool.api.query ?? {});
  if (format !== "text") params.set("format", format);

  // URLSearchParams percent-encodes "/" and ":", which turns a readable
  // `cidr=10.0.0.0/22` into `cidr=10.0.0.0%2F22`. Both characters are legal
  // in a query component (RFC 3986: query = *( pchar / "/" / "?" )), so put
  // them back — these snippets are meant to be read as much as run.
  const encoded = params.toString().replace(/%2F/g, "/").replace(/%3A/g, ":");

  return encoded ? `?${encoded}` : "";
}

function url(tool: Tool, format: ApiFormat): string {
  return `${API_BASE}/${tool.id}${queryString(tool, format)}`;
}

/** How the decoded result reads in each language, per the tool's result shape. */
const TYPE_HINTS: Record<
  Tool["api"]["resultKind"],
  Record<SnippetLanguage, string>
> = {
  lines: {
    curl: "one value per line",
    powershell: "string[]",
    python: "list[str]",
    javascript: "string[]",
    go: "[]string",
  },
  fields: {
    curl: "aligned label / value pairs",
    powershell: "hashtable",
    python: "dict[str, str]",
    javascript: "Record<string, string>",
    go: "map[string]string",
  },
  text: {
    curl: "a single value",
    powershell: "string",
    python: "str",
    javascript: "string",
    go: "string",
  },
};

// -------------------------------------------------------------------- curl

function curlSnippet(tool: Tool, format: ApiFormat): string {
  const target = url(tool, format);

  if (tool.api.bodyFile) {
    return `curl --data-binary @${tool.api.bodyFile} \\\n  '${target}'`;
  }
  return `curl '${target}'`;
}

// -------------------------------------------------------------- powershell

function powershellSnippet(tool: Tool): string {
  const target = url(tool, "json");
  const kind = tool.api.resultKind;

  const decode =
    kind === "fields"
      ? // -AsHashtable needs the raw text, so this goes through Invoke-WebRequest
        // rather than Invoke-RestMethod's automatic PSCustomObject.
        `$response = Invoke-WebRequest -Uri '${target}'\n` +
        `$data = $response.Content | ConvertFrom-Json -AsHashtable\n\n` +
        `$data.result        # hashtable\n` +
        `$data.result.Keys | Sort-Object`
      : kind === "lines"
        ? `$data = Invoke-RestMethod -Uri '${target}'\n\n` +
          `$data.result       # string[]\n` +
          `$data.result[0]`
        : `$data = Invoke-RestMethod -Uri '${target}'\n\n` + `$data.result       # string`;

  if (tool.api.bodyFile) {
    return (
      `$body = Get-Content -Raw '${tool.api.bodyFile}'\n` +
      `$data = Invoke-RestMethod -Uri '${target}' -Method Post \`\n` +
      `  -Body $body -ContentType 'text/plain'\n\n` +
      `$data.result       # ${TYPE_HINTS[kind].powershell}`
    );
  }

  return decode;
}

// ------------------------------------------------------------------ python

function pythonSnippet(tool: Tool): string {
  const params = { ...(tool.api.query ?? {}), format: "json" };
  const hint = TYPE_HINTS[tool.api.resultKind].python;

  // The POST form nests one level deeper inside `with open(...)`, so the
  // dict entries need a matching indent or the snippet reads as broken Python.
  const entries = (indent: string) =>
    Object.entries(params)
      .map(([key, value]) => `${indent}${JSON.stringify(key)}: ${JSON.stringify(value)},`)
      .join("\n");

  if (tool.api.bodyFile) {
    return (
      `import requests\n\n` +
      `with open(${JSON.stringify(tool.api.bodyFile)}) as handle:\n` +
      `    response = requests.post(\n` +
      `        "${API_BASE}/${tool.id}",\n` +
      `        params={\n${entries("            ")}\n        },\n` +
      `        data=handle.read(),\n` +
      `    )\n\n` +
      `response.raise_for_status()\n` +
      `result = response.json()["result"]  # ${hint}`
    );
  }

  return (
    `import requests\n\n` +
    `response = requests.get(\n` +
    `    "${API_BASE}/${tool.id}",\n` +
    `    params={\n${entries("        ")}\n    },\n` +
    `)\n\n` +
    `response.raise_for_status()\n` +
    `result = response.json()["result"]  # ${hint}`
  );
}

// -------------------------------------------------------------- javascript

function javascriptSnippet(tool: Tool): string {
  const params = { ...(tool.api.query ?? {}), format: "json" };
  const entries = Object.entries(params)
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    .join("\n");

  const hint = TYPE_HINTS[tool.api.resultKind].javascript;

  if (tool.api.bodyFile) {
    // A template literal keeps a multi-line sample readable; JSON.stringify
    // would collapse it into one line of escape sequences.
    const sample = (tool.api.bodySample ?? "").replace(/`/g, "\\`").replace(/\$/g, "\\$");

    return (
      `const params = new URLSearchParams({\n${entries}\n});\n\n` +
      `const body = \`${sample}\`;\n\n` +
      `const response = await fetch(\`${API_BASE}/${tool.id}?\${params}\`, {\n` +
      `  method: "POST",\n` +
      `  headers: { "Content-Type": "text/plain" },\n` +
      `  body,\n` +
      `});\n\n` +
      `const { result } = await response.json(); // ${hint}`
    );
  }

  return (
    `const params = new URLSearchParams({\n${entries}\n});\n\n` +
    `const response = await fetch(\`${API_BASE}/${tool.id}?\${params}\`);\n` +
    `const { result } = await response.json(); // ${hint}`
  );
}

// ---------------------------------------------------------------------- go

function goSnippet(tool: Tool): string {
  const target = url(tool, "json");
  const kind = tool.api.resultKind;

  const goType =
    kind === "lines" ? "[]string" : kind === "fields" ? "map[string]string" : "string";

  const request = tool.api.bodyFile
    ? `body, err := os.ReadFile(${JSON.stringify(tool.api.bodyFile)})\n` +
      `if err != nil {\n\tlog.Fatal(err)\n}\n\n` +
      `resp, err := http.Post("${target}", "text/plain", bytes.NewReader(body))`
    : `resp, err := http.Get("${target}")`;

  const imports = tool.api.bodyFile
    ? `import (\n\t"bytes"\n\t"encoding/json"\n\t"log"\n\t"net/http"\n\t"os"\n)`
    : `import (\n\t"encoding/json"\n\t"log"\n\t"net/http"\n)`;

  return (
    `${imports}\n\n` +
    `var payload struct {\n\tResult ${goType} \`json:"result"\`\n}\n\n` +
    `${request}\n` +
    `if err != nil {\n\tlog.Fatal(err)\n}\n` +
    `defer resp.Body.Close()\n\n` +
    `if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {\n\tlog.Fatal(err)\n}\n\n` +
    `// payload.Result is a ${goType}`
  );
}

// ------------------------------------------------------------------ public

export function snippetFor(
  tool: Tool,
  language: SnippetLanguage,
  format: ApiFormat = "text",
): string {
  switch (language) {
    case "powershell":
      return powershellSnippet(tool);
    case "python":
      return pythonSnippet(tool);
    case "javascript":
      return javascriptSnippet(tool);
    case "go":
      return goSnippet(tool);
    default:
      return curlSnippet(tool, format);
  }
}

/** The one-line curl used in the /api/v1 index and anywhere a short example fits. */
export function curlExample(tool: Tool): string {
  return curlSnippet(tool, "text").replace(/ \\\n\s+/g, " ");
}

export function resultHint(tool: Tool, language: SnippetLanguage): string {
  return TYPE_HINTS[tool.api.resultKind][language];
}
