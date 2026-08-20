import { API_BASE } from "../site";
import type { ApiFormat } from "./format";
import type { Tool } from "./registry";

export { API_BASE };

// Alphabetical, which is also the order the picker renders them in.
export const SNIPPET_LANGUAGES = [
  "curl",
  "go",
  "javascript",
  "powershell",
  "python",
  "ruby",
  "rust",
] as const;

export type SnippetLanguage = (typeof SNIPPET_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SnippetLanguage, string> = {
  curl: "curl",
  go: "Go",
  javascript: "JavaScript",
  powershell: "PowerShell",
  python: "Python",
  ruby: "Ruby",
  rust: "Rust",
};

/**
 * What the snippet leaves you holding.
 *
 * For curl these are wire formats, because that is all curl can meaningfully
 * vary. For every other language they are native shapes — the point of using
 * PowerShell over curl is getting a hashtable, not a string.
 */
export type OutputShape =
  | "text"
  | "json"
  | "xml"
  | "array"
  | "set"
  | "list"
  | "tuple"
  | "pyset"
  | "dict"
  | "items"
  | "hashtable"
  | "pscustomobject"
  | "object"
  | "map"
  | "entries"
  | "hash"
  | "pairs"
  | "typed";

export type OutputOption = { value: OutputShape; label: string };

type ResultKind = Tool["api"]["resultKind"];

/**
 * The shapes on offer depend on both the language and what the tool returns —
 * a list of UUIDs has no sensible hashtable form, and a set of subnet readings
 * has no sensible tuple form.
 */
export function outputsFor(language: SnippetLanguage, kind: ResultKind): OutputOption[] {
  if (language === "curl") {
    return [
      { value: "text", label: "text" },
      { value: "json", label: "json" },
      { value: "xml", label: "xml" },
    ];
  }

  const plain: OutputOption = { value: "text", label: "text" };

  switch (language) {
    case "powershell":
      if (kind === "lines") {
        return [plain, { value: "array", label: "array" }];
      }
      if (kind === "fields") {
        return [
          plain,
          { value: "hashtable", label: "hashtable" },
          { value: "pscustomobject", label: "PSCustomObject" },
        ];
      }
      if (kind === "rows") {
        return [plain, { value: "array", label: "PSCustomObject[]" }];
      }
      return [plain, { value: "typed", label: "string" }];

    case "python":
      if (kind === "lines") {
        return [
          plain,
          { value: "list", label: "list" },
          { value: "tuple", label: "tuple" },
          { value: "pyset", label: "set" },
        ];
      }
      if (kind === "fields") {
        return [
          plain,
          { value: "dict", label: "dict" },
          { value: "items", label: "items" },
        ];
      }
      if (kind === "rows") {
        return [plain, { value: "list", label: "list[dict]" }];
      }
      return [plain, { value: "typed", label: "str" }];

    case "javascript":
      if (kind === "lines") {
        return [plain, { value: "array", label: "array" }, { value: "set", label: "Set" }];
      }
      if (kind === "fields") {
        return [
          plain,
          { value: "object", label: "object" },
          { value: "map", label: "Map" },
          { value: "entries", label: "entries" },
        ];
      }
      if (kind === "rows") {
        return [plain, { value: "array", label: "object[]" }];
      }
      return [plain, { value: "typed", label: "string" }];

    case "go":
      if (kind === "lines") {
        return [plain, { value: "typed", label: "[]string" }];
      }
      if (kind === "fields") {
        return [plain, { value: "typed", label: "map[string]string" }];
      }
      if (kind === "rows") {
        return [plain, { value: "typed", label: "[]map[string]string" }];
      }
      return [plain, { value: "typed", label: "string" }];

    case "ruby":
      if (kind === "lines") {
        return [plain, { value: "array", label: "Array" }, { value: "set", label: "Set" }];
      }
      if (kind === "fields") {
        return [
          plain,
          { value: "hash", label: "Hash" },
          { value: "pairs", label: "pairs" },
        ];
      }
      if (kind === "rows") {
        return [plain, { value: "array", label: "Array<Hash>" }];
      }
      return [plain, { value: "typed", label: "String" }];

    case "rust":
      if (kind === "lines") {
        return [plain, { value: "typed", label: "Vec<String>" }];
      }
      if (kind === "fields") {
        return [plain, { value: "typed", label: "HashMap<String, String>" }];
      }
      if (kind === "rows") {
        return [plain, { value: "typed", label: "Vec<HashMap<String, String>>" }];
      }
      return [plain, { value: "typed", label: "String" }];
  }
}

/** The shape a language opens on: its native one, or text for curl. */
export function defaultOutput(language: SnippetLanguage, kind: ResultKind): OutputShape {
  const options = outputsFor(language, kind);
  return language === "curl" ? "text" : (options[1]?.value ?? "text");
}

/** Whether a chosen shape is still on offer after switching language. */
export function isOutputAvailable(
  language: SnippetLanguage,
  kind: ResultKind,
  shape: OutputShape,
): boolean {
  return outputsFor(language, kind).some((option) => option.value === shape);
}

/** Which wire format a shape needs. Only "text" avoids JSON. */
function wireFormat(shape: OutputShape): ApiFormat {
  if (shape === "text") return "text";
  if (shape === "xml") return "xml";
  return "json";
}

/**
 * The query string for the languages that build a URL by hand.
 *
 * Where the tool allows it, the required parameter is written without its name
 * — `?10.0.0.0/22` rather than `?cidr=10.0.0.0/22` — since that is the form
 * someone typing curl would actually use. The languages that pass a parameter
 * map instead (Python, JavaScript, Ruby) keep the names, because a keyless
 * entry in a dict is a worse thing to teach than a slightly longer URL.
 */
function queryString(tool: Tool, format: ApiFormat): string {
  const query = { ...(tool.api.query ?? {}) };

  const bare = tool.api.bareParam;
  const bareValue = bare ? query[bare] : undefined;
  if (bare && bareValue !== undefined) delete query[bare];

  const params = new URLSearchParams(query);
  if (format !== "text") params.set("format", format);

  // URLSearchParams percent-encodes "/" and ":", which turns a readable
  // `cidr=10.0.0.0/22` into `cidr=10.0.0.0%2F22`. Both characters are legal
  // in a query component (RFC 3986: query = *( pchar / "/" / "?" )), so put
  // them back — these snippets are meant to be read as much as run.
  const readable = (value: string) => value.replace(/%2F/g, "/").replace(/%3A/g, ":");

  const encoded = readable(params.toString());

  // Encoded through URLSearchParams too, so a cron expression's spaces come
  // out as "+" exactly as they do in the named form — and are read back as
  // spaces by the same parser on the other end.
  const encodedBare =
    bareValue === undefined
      ? ""
      : readable(new URLSearchParams({ value: bareValue }).toString().slice("value=".length));

  // The bare value leads, so the eye lands on it rather than on ?format=.
  const parts = [encodedBare, encoded].filter((part) => part);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

function url(tool: Tool, shape: OutputShape): string {
  return `${API_BASE}/${tool.id}${queryString(tool, wireFormat(shape))}`;
}

function sampleKey(tool: Tool): string {
  return tool.api.sampleKey ?? "result";
}

// -------------------------------------------------------------------- curl

function curlSnippet(tool: Tool, shape: OutputShape): string {
  const target = url(tool, shape);

  if (tool.api.bodyFile) {
    return `curl --data-binary @${tool.api.bodyFile} \\\n  '${target}'`;
  }
  return `curl '${target}'`;
}

// -------------------------------------------------------------- powershell

function powershellSnippet(tool: Tool, shape: OutputShape): string {
  const target = url(tool, shape);

  const fetchLine = tool.api.bodyFile
    ? `$body = Get-Content -Raw '${tool.api.bodyFile}'\n` +
      `$response = Invoke-RestMethod -Uri '${target}' -Method Post \`\n` +
      `  -Body $body -ContentType 'text/plain'`
    : `$response = Invoke-RestMethod -Uri '${target}'`;

  if (shape === "text") {
    return `${fetchLine}\n\n$response`;
  }

  if (shape === "hashtable") {
    // -AsHashtable only exists on ConvertFrom-Json, so this has to go through
    // Invoke-WebRequest and convert the raw body itself.
    const raw = tool.api.bodyFile
      ? `$body = Get-Content -Raw '${tool.api.bodyFile}'\n` +
        `$response = Invoke-WebRequest -Uri '${target}' -Method Post \`\n` +
        `  -Body $body -ContentType 'text/plain'`
      : `$response = Invoke-WebRequest -Uri '${target}'`;

    return (
      `${raw}\n` +
      `$fields = ($response.Content | ConvertFrom-Json -AsHashtable).result\n\n` +
      `$fields['${sampleKey(tool)}']\n` +
      `$fields.Keys | Sort-Object`
    );
  }

  if (shape === "pscustomobject") {
    return `${fetchLine}\n$fields = $response.result\n\n$fields.${sampleKey(tool)}`;
  }

  if (shape === "array") {
    return `${fetchLine}\n$items = $response.result\n\n$items[0]\n$items.Count`;
  }

  return `${fetchLine}\n$value = $response.result\n\n$value`;
}

// ------------------------------------------------------------------ python

function pythonSnippet(tool: Tool, shape: OutputShape): string {
  const format = wireFormat(shape);
  const params: Record<string, string> = { ...(tool.api.query ?? {}) };
  if (format !== "text") params.format = format;

  const entries = (indent: string) =>
    Object.entries(params)
      .map(([key, value]) => `${indent}${JSON.stringify(key)}: ${JSON.stringify(value)},`)
      .join("\n");

  const call = tool.api.bodyFile
    ? `with open(${JSON.stringify(tool.api.bodyFile)}) as handle:\n` +
      `    response = requests.post(\n` +
      `        "${API_BASE}/${tool.id}",\n` +
      `        params={\n${entries("            ")}\n        },\n` +
      `        data=handle.read(),\n` +
      `    )`
    : `response = requests.get(\n` +
      `    "${API_BASE}/${tool.id}",\n` +
      `    params={\n${entries("        ")}\n    },\n` +
      `)`;

  const head = `import requests\n\n${call}\n\nresponse.raise_for_status()\n`;

  switch (shape) {
    case "text":
      return `${head}result = response.text`;
    case "list":
      return `${head}result = response.json()["result"]\n\nresult[0]`;
    case "tuple":
      return `${head}result = tuple(response.json()["result"])`;
    case "pyset":
      return `${head}result = set(response.json()["result"])`;
    case "dict":
      return `${head}result = response.json()["result"]\n\nresult["${sampleKey(tool)}"]`;
    case "items":
      return `${head}result = list(response.json()["result"].items())\n\nfor key, value in result:\n    print(key, value)`;
    default:
      return `${head}result = response.json()["result"]`;
  }
}

// -------------------------------------------------------------- javascript

function javascriptSnippet(tool: Tool, shape: OutputShape): string {
  const format = wireFormat(shape);
  const params: Record<string, string> = { ...(tool.api.query ?? {}) };
  if (format !== "text") params.format = format;

  const entries = Object.entries(params)
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    .join("\n");

  const paramsBlock = entries
    ? `const params = new URLSearchParams({\n${entries}\n});\n\n`
    : `const params = new URLSearchParams();\n\n`;

  let call: string;
  if (tool.api.bodyFile) {
    // The body is inlined rather than read off disk, so the snippet runs in a
    // browser console as well as in Node. A template literal keeps a
    // multi-line sample readable; JSON.stringify would collapse it into one
    // line of escape sequences.
    const sample = (tool.api.bodySample ?? "").replace(/`/g, "\\`").replace(/\$/g, "\\$");
    call =
      `// In Node, read it from disk instead: readFile(path, "utf8").\n` +
      `const body = \`${sample}\`;\n\n` +
      `const response = await fetch(\`${API_BASE}/${tool.id}?\${params}\`, {\n` +
      `  method: "POST",\n` +
      `  headers: { "Content-Type": "text/plain" },\n` +
      `  body,\n` +
      `});`;
  } else {
    call = `const response = await fetch(\`${API_BASE}/${tool.id}?\${params}\`);`;
  }

  const head = `${paramsBlock}${call}\n\n`;

  switch (shape) {
    case "text":
      return `${head}const result = await response.text();`;
    case "array":
      return `${head}const { result } = await response.json();\n\nresult[0];`;
    case "set":
      return `${head}const { result } = await response.json();\nconst unique = new Set(result);`;
    case "object":
      return `${head}const { result } = await response.json();\n\nresult["${sampleKey(tool)}"];`;
    case "map":
      return `${head}const { result } = await response.json();\nconst fields = new Map(Object.entries(result));\n\nfields.get("${sampleKey(tool)}");`;
    case "entries":
      return `${head}const { result } = await response.json();\nconst entries = Object.entries(result);\n\nfor (const [key, value] of entries) {\n  console.log(key, value);\n}`;
    default:
      return `${head}const { result } = await response.json();`;
  }
}

// ---------------------------------------------------------------------- go

function goSnippet(tool: Tool, shape: OutputShape): string {
  const target = url(tool, shape);
  const kind = tool.api.resultKind;

  const goType =
    kind === "lines"
      ? "[]string"
      : kind === "fields"
        ? "map[string]string"
        : kind === "rows"
          ? "[]map[string]string"
          : "string";

  const request = tool.api.bodyFile
    ? `body, err := os.ReadFile(${JSON.stringify(tool.api.bodyFile)})\n` +
      `if err != nil {\n\tlog.Fatal(err)\n}\n\n` +
      `resp, err := http.Post("${target}", "text/plain", bytes.NewReader(body))`
    : `resp, err := http.Get("${target}")`;

  // gofmt orders imports alphabetically within the block, so build the list
  // and sort rather than hand-writing a block per combination.
  const importBlock = (extra: string[]) => {
    const names = ["log", "net/http", ...extra];
    if (tool.api.bodyFile) names.push("bytes", "os");
    const sorted = [...new Set(names)].sort();
    return `import (\n${sorted.map((name) => `\t"${name}"`).join("\n")}\n)`;
  };

  if (shape === "text") {
    return (
      `${importBlock(["fmt", "io"])}\n\n` +
      `${request}\n` +
      `if err != nil {\n\tlog.Fatal(err)\n}\n` +
      `defer resp.Body.Close()\n\n` +
      `result, err := io.ReadAll(resp.Body)\n` +
      `if err != nil {\n\tlog.Fatal(err)\n}\n\n` +
      `fmt.Println(string(result))`
    );
  }

  const imports = importBlock(["encoding/json"]);

  return (
    `${imports}\n\n` +
    `var payload struct {\n\tResult ${goType} \`json:"result"\`\n}\n\n` +
    `${request}\n` +
    `if err != nil {\n\tlog.Fatal(err)\n}\n` +
    `defer resp.Body.Close()\n\n` +
    `if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {\n\tlog.Fatal(err)\n}`
  );
}

// -------------------------------------------------------------------- ruby

function rubySnippet(tool: Tool, shape: OutputShape): string {
  const format = wireFormat(shape);
  const params: Record<string, string> = { ...(tool.api.query ?? {}) };
  if (format !== "text") params.format = format;

  // Ruby style is one require per line, alphabetically.
  const names = ["net/http"];
  if (shape !== "text") names.push("json");
  if (shape === "set") names.push("set");
  const requires = [...new Set(names)]
    .sort()
    .map((name) => `require "${name}"`)
    .join("\n");

  const entries = Object.entries(params)
    .map(([key, value]) => `  ${JSON.stringify(key)} => ${JSON.stringify(value)},`)
    .join("\n");

  const uri = entries
    ? `uri = URI("${API_BASE}/${tool.id}")\nuri.query = URI.encode_www_form(\n${entries}\n)`
    : `uri = URI("${API_BASE}/${tool.id}")`;

  const request = tool.api.bodyFile
    ? `body = File.read(${JSON.stringify(tool.api.bodyFile)})\n` +
      `response = Net::HTTP.post(uri, body, "Content-Type" => "text/plain")`
    : `response = Net::HTTP.get_response(uri)`;

  const head =
    `${requires}\n\n${uri}\n\n${request}\n` +
    `raise response.message unless response.is_a?(Net::HTTPSuccess)\n\n`;

  const parsed = `JSON.parse(response.body)["result"]`;

  switch (shape) {
    case "text":
      return `${head}result = response.body\n\nputs result`;
    case "array":
      return `${head}result = ${parsed}\n\nresult.first`;
    case "set":
      return `${head}result = ${parsed}.to_set`;
    case "hash":
      return `${head}result = ${parsed}\n\nresult["${sampleKey(tool)}"]`;
    case "pairs":
      return (
        `${head}result = ${parsed}.to_a\n\n` +
        `result.each do |key, value|\n  puts "#{key} #{value}"\nend`
      );
    default:
      return `${head}result = ${parsed}`;
  }
}

// -------------------------------------------------------------------- rust

function rustSnippet(tool: Tool, shape: OutputShape): string {
  const target = url(tool, shape);
  const kind = tool.api.resultKind;

  const rustType =
    kind === "lines"
      ? "Vec<String>"
      : kind === "fields"
        ? "HashMap<String, String>"
        : kind === "rows"
          ? "Vec<HashMap<String, String>>"
          : "String";

  const request = tool.api.bodyFile
    ? `let body = fs::read_to_string(${JSON.stringify(tool.api.bodyFile)})?;\n\n` +
      `let response = reqwest::blocking::Client::new()\n` +
      `    .post("${target}")\n` +
      `    .header("Content-Type", "text/plain")\n` +
      `    .body(body)\n` +
      `    .send()?;`
    : `let response = reqwest::blocking::get("${target}")?;`;

  // rustfmt sorts a use block alphabetically, so build the list and sort
  // rather than hand-writing a block per combination.
  const importBlock = (extra: string[]) => {
    const names = [...extra];
    if (tool.api.bodyFile) names.push("std::fs");
    return [...new Set(names)]
      .sort()
      .map((name) => `use ${name};`)
      .join("\n");
  };

  if (shape === "text") {
    const uses = importBlock([]);
    return (
      (uses ? `${uses}\n\n` : "") +
      `${request}\n\n` +
      `let result = response.text()?;\n\n` +
      `println!("{result}");`
    );
  }

  const extra = ["serde::Deserialize"];
  if (kind === "fields" || kind === "rows") extra.push("std::collections::HashMap");

  return (
    `${importBlock(extra)}\n\n` +
    `#[derive(Deserialize)]\n` +
    `struct Payload {\n    result: ${rustType},\n}\n\n` +
    `${request}\n\n` +
    `let payload: Payload = response.json()?;`
  );
}

// ------------------------------------------------------------------ public

export function snippetFor(
  tool: Tool,
  language: SnippetLanguage,
  shape: OutputShape,
): string {
  switch (language) {
    case "go":
      return goSnippet(tool, shape);
    case "javascript":
      return javascriptSnippet(tool, shape);
    case "powershell":
      return powershellSnippet(tool, shape);
    case "python":
      return pythonSnippet(tool, shape);
    case "ruby":
      return rubySnippet(tool, shape);
    case "rust":
      return rustSnippet(tool, shape);
    default:
      return curlSnippet(tool, shape);
  }
}

/** The one-line curl used in the /api/v1 index and anywhere a short example fits. */
export function curlExample(tool: Tool): string {
  return curlSnippet(tool, "text").replace(/ \\\n\s+/g, " ");
}
