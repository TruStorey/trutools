/**
 * The single source of truth for trutools.
 *
 * This module drives the card grid, the search filter, the /api/v1 discovery
 * index and the /api/v1/[tool] dispatch. Keep it free of React and lucide
 * imports — the route handlers import it, and dragging icon components into a
 * server bundle buys nothing. Icons are referenced by string key and resolved
 * in components/tools/icon-map.ts.
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
  /** Key into components/tools/icon-map.ts. */
  icon: string;
  /** Extra search terms beyond name + description. */
  keywords: string[];
  api: {
    status: ToolStatus;
    params: ApiParam[];
    /** Shown on the card and in the /api/v1 index. */
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
      status: "planned",
      params: [
        { name: "length", required: false, description: "Password length. Default 24, max 256." },
        { name: "symbols", required: false, description: "Include punctuation. Default true." },
        { name: "digits", required: false, description: "Include digits. Default true." },
        { name: "count", required: false, description: "How many to return. Default 1, max 100." },
      ],
      example: "curl 'https://trutools.truvibe.dev/api/v1/password-generator?length=32'",
    },
  },
  {
    id: "uuid-generator",
    name: "UUID Generator",
    description:
      "Mint UUIDs on demand. Version 4 for pure randomness, version 7 when you want them to sort by time.",
    section: "crypto",
    icon: "fingerprint",
    keywords: ["uuid", "guid", "v4", "v7", "identifier", "unique", "ulid"],
    api: {
      status: "planned",
      params: [
        { name: "version", required: false, description: "4 or 7. Default 4." },
        { name: "count", required: false, description: "How many to return. Default 1, max 1000." },
      ],
      example: "curl 'https://trutools.truvibe.dev/api/v1/uuid-generator?version=7&count=5'",
    },
  },
  {
    id: "token-generator",
    name: "Token / API Key Generator",
    description:
      "Cryptographically random tokens with an optional prefix, so a leaked key is obvious in a log.",
    section: "crypto",
    icon: "key-square",
    keywords: ["token", "api key", "apikey", "bearer", "secret", "nonce", "base64", "hex"],
    api: {
      status: "planned",
      params: [
        { name: "bytes", required: false, description: "Entropy in bytes. Default 32, max 256." },
        { name: "encoding", required: false, description: "hex, base64url or base58. Default base64url." },
        { name: "prefix", required: false, description: "String prepended to the token, e.g. sk_live." },
      ],
      example: "curl 'https://trutools.truvibe.dev/api/v1/token-generator?bytes=32&prefix=sk_live'",
    },
  },
  {
    id: "ssh-keypair-generator",
    name: "SSH Keypair Generator",
    description:
      "Produce an OpenSSH keypair — ed25519 or RSA — and get the private key plus a ready-to-paste public key.",
    section: "crypto",
    icon: "terminal",
    keywords: ["ssh", "keypair", "ed25519", "rsa", "openssh", "private key", "public key", "authorized_keys"],
    api: {
      status: "planned",
      params: [
        { name: "type", required: false, description: "ed25519 or rsa. Default ed25519." },
        { name: "bits", required: false, description: "RSA modulus size. 2048 or 4096. Ignored for ed25519." },
        { name: "comment", required: false, description: "Trailing comment on the public key." },
      ],
      example: "curl 'https://trutools.truvibe.dev/api/v1/ssh-keypair-generator?type=ed25519'",
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
    api: {
      status: "planned",
      params: [
        { name: "body", required: true, description: "The PEM certificate, POSTed as the raw request body." },
      ],
      example:
        "curl --data-binary @cert.pem https://trutools.truvibe.dev/api/v1/cert-reader",
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
    keywords: ["subnet", "cidr", "netmask", "ipv4", "ipv6", "network", "broadcast", "vlsm", "calculator"],
    api: {
      status: "planned",
      params: [
        { name: "cidr", required: true, description: "The network in CIDR form, e.g. 10.0.0.0/22." },
      ],
      example: "curl 'https://trutools.truvibe.dev/api/v1/subnet-calculator?cidr=10.0.0.0/22'",
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
    api: {
      status: "live",
      params: [],
      example: "curl https://trutools.truvibe.dev/api/v1/ip",
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
    keywords: ["timestamp", "epoch", "unix", "iso8601", "date", "time", "utc", "convert"],
    api: {
      status: "planned",
      params: [
        { name: "value", required: true, description: "Epoch seconds, epoch millis, or an ISO 8601 string." },
        { name: "tz", required: false, description: "IANA timezone for the readable output. Default UTC." },
      ],
      example: "curl 'https://trutools.truvibe.dev/api/v1/timestamp-converter?value=1754870400'",
    },
  },
  {
    id: "json-beautify",
    name: "Beautify JSON",
    description:
      "Reformat minified JSON into something you can read, or minify it back down. Reports the parse error if it will not parse.",
    section: "data-format",
    icon: "braces",
    keywords: ["json", "beautify", "pretty", "format", "minify", "indent", "validate", "prettify"],
    api: {
      status: "planned",
      params: [
        { name: "body", required: true, description: "The JSON document, POSTed as the raw request body." },
        { name: "indent", required: false, description: "Spaces per level, or 0 to minify. Default 2." },
        { name: "sort", required: false, description: "Sort object keys alphabetically. Default false." },
      ],
      example:
        "curl --data-binary @data.json 'https://trutools.truvibe.dev/api/v1/json-beautify?indent=2'",
    },
  },

  // ------------------------------------------------------------------ text
  {
    id: "text-tool",
    name: "Text Tool",
    description:
      "Join lines into one, split one into many, trim whitespace and drop the blanks or the duplicates.",
    section: "text",
    icon: "text-quote",
    keywords: ["text", "join", "split", "lines", "trim", "dedupe", "whitespace", "csv", "list"],
    api: {
      status: "planned",
      params: [
        { name: "body", required: true, description: "The input text, POSTed as the raw request body." },
        { name: "op", required: true, description: "join, split, trim, dedupe or sort." },
        { name: "sep", required: false, description: "Separator for join and split. Default a comma." },
      ],
      example:
        "curl --data-binary @hosts.txt 'https://trutools.truvibe.dev/api/v1/text-tool?op=join&sep=,'",
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
