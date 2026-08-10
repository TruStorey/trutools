/**
 * The single source of truth for trutools.
 *
 * This module drives the card grid, the search filter, the /api/v1 discovery
 * index and the /api/v1/[tool] dispatch. Keep it free of React and lucide
 * imports — the route handlers import it, and dragging icon components into a
 * server bundle buys nothing. Icons are referenced by string key and resolved
 * in components/tools/icon-map.tsx.
 */

export type SectionId = "crypto" | "networking" | "data-format" | "text";

export type ToolStatus = "live" | "planned";

export type ApiParam = {
  name: string;
  required: boolean;
  description: string;
};

export type Tool = {
  /** Also the /api/v1/<id> path segment. */
  id: string;
  name: string;
  description: string;
  section: SectionId;
  /** Key into components/tools/icon-map.tsx. */
  icon: string;
  /** Extra search terms beyond name + description. */
  keywords: string[];
  /**
   * True when the tool cannot run in the browser — it needs node:crypto for
   * X.509 parsing or OpenSSH key encoding. The interactive panel for these
   * calls our own API rather than computing locally.
   */
  serverOnly?: boolean;
  /** The interactive panel POSTs a document rather than filling in a form. */
  bodyInput?: boolean;
  api: {
    status: ToolStatus;
    method: "GET" | "POST";
    params: ApiParam[];
    /** Shown on the card's API tab and in the /api/v1 index. */
    example: string;
  };
};

export type Section = {
  id: SectionId;
  name: string;
  description: string;
};

export const SECTIONS: Section[] = [
  {
    id: "crypto",
    name: "Crypto",
    description: "Generate secrets, keys and identifiers.",
  },
  {
    id: "networking",
    name: "Networking",
    description: "Work out what is on the wire.",
  },
  {
    id: "data-format",
    name: "Data Format",
    description: "Reshape data into something readable.",
  },
  {
    id: "text",
    name: "Text",
    description: "Everyday string wrangling.",
  },
];

const BASE = "https://trutools.truvibe.dev/api/v1";

export const TOOLS: Tool[] = [
  // ---------------------------------------------------------------- crypto
  {
    id: "password-generator",
    name: "Password Generator",
    description:
      "Build strong random passwords with control over length and which character classes are in play.",
    section: "crypto",
    icon: "key-round",
    keywords: ["password", "passphrase", "random", "secret", "entropy", "generator"],
    api: {
      status: "live",
      method: "GET",
      params: [
        { name: "length", required: false, description: "4 to 256. Default 24." },
        { name: "count", required: false, description: "How many to return. 1 to 100. Default 1." },
        { name: "lowercase", required: false, description: "Include a-z. Default true." },
        { name: "uppercase", required: false, description: "Include A-Z. Default true." },
        { name: "digits", required: false, description: "Include 0-9. Default true." },
        { name: "symbols", required: false, description: "Include punctuation. Default true." },
        {
          name: "exclude-ambiguous",
          required: false,
          description: "Drop easily confused characters like O, 0, l and 1. Default false.",
        },
      ],
      example: `curl '${BASE}/password-generator?length=32&count=3'`,
    },
  },
  {
    id: "uuid-generator",
    name: "UUID Generator",
    description:
      "Mint UUIDs on demand. Version 4 for pure randomness, version 7 when you want them to sort by time.",
    section: "crypto",
    icon: "fingerprint",
    keywords: ["uuid", "guid", "v4", "v7", "identifier", "unique", "ulid", "rfc9562"],
    api: {
      status: "live",
      method: "GET",
      params: [
        { name: "version", required: false, description: "4 or 7. Default 4." },
        { name: "count", required: false, description: "1 to 1000. Default 1." },
        { name: "uppercase", required: false, description: "Return uppercase hex. Default false." },
        { name: "hyphens", required: false, description: "Include hyphens. Default true." },
      ],
      example: `curl '${BASE}/uuid-generator?version=7&count=5'`,
    },
  },
  {
    id: "token-generator",
    name: "Token / API Key Generator",
    description:
      "Cryptographically random tokens with an optional prefix, so a leaked key is obvious in a log.",
    section: "crypto",
    icon: "key-square",
    keywords: ["token", "api key", "apikey", "bearer", "secret", "nonce", "base64", "hex", "base58"],
    api: {
      status: "live",
      method: "GET",
      params: [
        { name: "bytes", required: false, description: "Entropy in bytes. 8 to 256. Default 32." },
        {
          name: "encoding",
          required: false,
          description: "base64url, hex or base58. Default base64url.",
        },
        { name: "prefix", required: false, description: "Prepended with an underscore, e.g. sk_live." },
        { name: "count", required: false, description: "1 to 100. Default 1." },
      ],
      example: `curl '${BASE}/token-generator?bytes=32&prefix=sk_live'`,
    },
  },
  {
    id: "ssh-keypair-generator",
    name: "SSH Keypair Generator",
    description:
      "Produce an OpenSSH keypair — ed25519 or RSA — with the private key and a ready-to-paste public key.",
    section: "crypto",
    icon: "terminal",
    keywords: [
      "ssh",
      "keypair",
      "ed25519",
      "rsa",
      "openssh",
      "private key",
      "public key",
      "authorized_keys",
    ],
    serverOnly: true,
    api: {
      status: "live",
      method: "GET",
      params: [
        { name: "type", required: false, description: "ed25519 or rsa. Default ed25519." },
        {
          name: "bits",
          required: false,
          description: "RSA modulus: 2048, 3072 or 4096. Ignored for ed25519. Default 4096.",
        },
        { name: "comment", required: false, description: "Trailing comment on the public key." },
      ],
      example: `curl '${BASE}/ssh-keypair-generator?type=ed25519&comment=laptop'`,
    },
  },
  {
    id: "cert-reader",
    name: "Certificate Reader",
    description:
      "Paste a PEM certificate and read back the subject, issuer, SANs, validity window and fingerprints.",
    section: "crypto",
    icon: "file-badge",
    keywords: ["certificate", "cert", "x509", "pem", "tls", "ssl", "san", "fingerprint", "expiry"],
    serverOnly: true,
    bodyInput: true,
    api: {
      status: "live",
      method: "POST",
      params: [
        {
          name: "body",
          required: true,
          description: "The PEM certificate, POSTed as the raw request body.",
        },
      ],
      example: `curl --data-binary @cert.pem ${BASE}/cert-reader`,
    },
  },

  // ------------------------------------------------------------ networking
  {
    id: "subnet-calculator",
    name: "Subnet Calculator",
    description:
      "Turn CIDR into the numbers you actually need: network, broadcast, usable range, mask and host count.",
    section: "networking",
    icon: "network",
    keywords: [
      "subnet",
      "cidr",
      "netmask",
      "ipv4",
      "ipv6",
      "network",
      "broadcast",
      "vlsm",
      "calculator",
    ],
    api: {
      status: "live",
      method: "GET",
      params: [
        {
          name: "cidr",
          required: true,
          description: "The network in CIDR form, IPv4 or IPv6, e.g. 10.0.0.0/22.",
        },
      ],
      example: `curl '${BASE}/subnet-calculator?cidr=10.0.0.0/22'`,
    },
  },
  {
    id: "ip",
    name: "What Is My IP",
    description:
      "Echo back the public IP address the request arrived from. Plain text, nothing else — pipe it straight into a script.",
    section: "networking",
    icon: "globe",
    keywords: ["ip", "icanhazip", "address", "public ip", "myip", "whatismyip", "egress"],
    serverOnly: true,
    api: {
      status: "live",
      method: "GET",
      params: [],
      example: `curl ${BASE}/ip`,
    },
  },

  // ----------------------------------------------------------- data format
  {
    id: "timestamp-converter",
    name: "Timestamp Converter",
    description:
      "Move between Unix epoch, ISO 8601 and human-readable dates without opening a REPL to do it.",
    section: "data-format",
    icon: "clock",
    keywords: ["timestamp", "epoch", "unix", "iso8601", "date", "time", "utc", "convert", "tz"],
    api: {
      status: "live",
      method: "GET",
      params: [
        {
          name: "value",
          required: false,
          description: 'Epoch seconds, epoch millis, an ISO 8601 string, or "now". Default now.',
        },
        { name: "tz", required: false, description: "IANA timezone for the readable line. Default UTC." },
      ],
      example: `curl '${BASE}/timestamp-converter?value=1754870400&tz=Europe/London'`,
    },
  },
  {
    id: "json-beautify",
    name: "Beautify JSON",
    description:
      "Reformat minified JSON into something readable, or minify it back down. Reports the parse error if it will not parse.",
    section: "data-format",
    icon: "braces",
    keywords: ["json", "beautify", "pretty", "format", "minify", "indent", "validate", "prettify"],
    bodyInput: true,
    api: {
      status: "live",
      method: "POST",
      params: [
        { name: "body", required: true, description: "The JSON document, POSTed as the raw request body." },
        { name: "indent", required: false, description: "Spaces per level, 0 to 8. 0 minifies. Default 2." },
        { name: "sort", required: false, description: "Sort object keys alphabetically. Default false." },
      ],
      example: `curl --data-binary @data.json '${BASE}/json-beautify?indent=2'`,
    },
  },

  // ------------------------------------------------------------------ text
  {
    id: "text-tool",
    name: "Text Tool",
    description:
      "Join lines into one, split one into many, trim whitespace, drop duplicates, sort, or just count what is there.",
    section: "text",
    icon: "text-quote",
    keywords: ["text", "join", "split", "lines", "trim", "dedupe", "sort", "count", "csv", "list"],
    bodyInput: true,
    api: {
      status: "live",
      method: "POST",
      params: [
        { name: "body", required: true, description: "The input text, POSTed as the raw request body." },
        {
          name: "op",
          required: false,
          description: "join, split, trim, dedupe, sort, reverse or count. Default join.",
        },
        {
          name: "sep",
          required: false,
          description: "Separator for join and split. Supports \\n and \\t. Default a comma.",
        },
        { name: "drop-empty", required: false, description: "Drop blank lines first. Default true." },
      ],
      example: `curl --data-binary @hosts.txt '${BASE}/text-tool?op=join&sep=,'`,
    },
  },
];

export function getTool(id: string): Tool | undefined {
  return TOOLS.find((tool) => tool.id === id);
}

export function getSection(id: SectionId): Section | undefined {
  return SECTIONS.find((section) => section.id === id);
}

export function toolsInSection(id: SectionId): Tool[] {
  return TOOLS.filter((tool) => tool.section === id);
}
