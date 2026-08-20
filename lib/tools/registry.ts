/**
 * The single source of truth for trutools.
 *
 * This module drives the card grid, the search filter, the /api/v1 discovery
 * index and the /api/v1/[tool] dispatch. Keep it free of React and lucide
 * imports — the route handlers import it, and dragging icon components into a
 * server bundle buys nothing. Icons are referenced by string key and resolved
 * in components/tools/icon-map.tsx.
 */

export type SectionId = "crypto" | "networking" | "data-format" | "text" | "system";

export type ToolStatus = "live" | "planned";

export type ApiParam = {
  name: string;
  required: boolean;
  description: string;
};

/**
 * Shown on the Hash Generator's page and in its API reference, and defined
 * once here so the two cannot drift. Deliberately not part of the response —
 * a caller parsing the JSON wants four digests, not prose mixed in with them.
 */
export const HASH_WEAK_ALGORITHM_NOTE =
  "MD5 and SHA-1 are broken for security. Use them for checksums only.";

export type Tool = {
  /**
   * The path segment, served at both /<id> and /api/v1/<id>.
   *
   * Because ids are root-level URLs, they share a namespace with any page the
   * site might add. Next resolves static segments before dynamic ones, so a
   * page at /search would silently shadow a tool with that id — pick ids that
   * are unlikely to collide.
   */
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
    /**
     * The shape this tool returns, used to type the generated code snippets
     * (a list in PowerShell, a dict in Python, and so on).
     */
    resultKind: "lines" | "fields" | "text" | "rows";
    /** Example query arguments. Snippets in every language are built from these. */
    query?: Record<string, string>;
    /** For body tools: the filename the example reads from. */
    bodyFile?: string;
    /** For body tools: a short inline sample, for languages that inline it. */
    bodySample?: string;
    /**
     * A representative key from a `fields` result, so snippets can show real
     * field access rather than a placeholder.
     */
    sampleKey?: string;
    /** A caveat about this tool specifically, shown above the shared one. */
    note?: string;
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
  {
    id: "system",
    name: "System",
    description: "Bits of Linux you have to look up every time.",
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
      resultKind: "lines",
      query: { length: "32", count: "3" },
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
      resultKind: "lines",
      query: { version: "7", count: "5" },
    },
  },
  {
    id: "token-generator",
    name: "Token Generator",
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
      resultKind: "lines",
      query: { bytes: "32", prefix: "sk_live" },
    },
  },
  {
    id: "hash-generator",
    name: "Hash Generator",
    description:
      "MD5, SHA-1, SHA-256 and SHA-512 of any text, all four at once or one at a time.",
    section: "crypto",
    icon: "hash",
    keywords: ["hash", "md5", "sha1", "sha256", "sha512", "checksum", "digest", "sum"],
    bodyInput: true,
    api: {
      status: "live",
      method: "POST",
      params: [
        { name: "body", required: true, description: "The text to hash, as the raw request body." },
        {
          name: "algo",
          required: false,
          description: "md5, sha1, sha256 or sha512. All four are returned if omitted.",
        },
      ],
      resultKind: "fields",
      bodyFile: "input.txt",
      bodySample: "hello world",
      sampleKey: "sha_256",
      note: HASH_WEAK_ALGORITHM_NOTE,
    },
  },
  {
    id: "jwt-decoder",
    name: "JWT Decoder",
    description:
      "Read the header, payload and expiry of a JSON Web Token. Inspection only — nothing is verified.",
    section: "crypto",
    icon: "badge-check",
    keywords: ["jwt", "token", "bearer", "claims", "oauth", "oidc", "decode", "exp"],
    api: {
      status: "live",
      method: "GET",
      params: [
        { name: "token", required: true, description: "The JWT, as three dot-separated parts." },
      ],
      resultKind: "fields",
      query: {
        token:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      },
      sampleKey: "algorithm",
    },
  },
  {
    id: "ssh-key-inspect",
    name: "SSH Key Inspector",
    description:
      "Read a public key or authorized_keys line: type, size, both fingerprints, comment and any forced options.",
    section: "crypto",
    icon: "file-key",
    keywords: [
      "ssh",
      "public key",
      "authorized_keys",
      "fingerprint",
      "sha256",
      "md5",
      "known_hosts",
      "ed25519",
      "rsa",
    ],
    bodyInput: true,
    api: {
      status: "live",
      method: "POST",
      params: [
        {
          name: "body",
          required: true,
          description: "The public key line, as the raw request body.",
        },
      ],
      resultKind: "fields",
      bodyFile: "id_ed25519.pub",
      bodySample: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... you@laptop",
      sampleKey: "sha256",
    },
  },
  {
    id: "ssh-keypair-generator",
    name: "SSH Keypair Generator",
    description:
      "Produce an OpenSSH keypair — ed25519 or RSA. Generated in your browser, so the private key never leaves the page.",
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
      resultKind: "fields",
      query: { type: "ed25519", comment: "laptop" },
      sampleKey: "public_key",
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
      resultKind: "fields",
      bodyFile: "cert.pem",
      sampleKey: "subject",
      bodySample: "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
    },
  },

  // ------------------------------------------------------------ networking
  {
    id: "subnet-inspector",
    name: "Subnet Inspector",
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
      // The tool used to be called a calculator, and people still search for it
      // that way — along with the other words for "tell me about this block".
      "calculator",
      "inspector",
      "info",
      "lookup",
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
      resultKind: "fields",
      query: { cidr: "10.0.0.0/22" },
      sampleKey: "network",
    },
  },
  {
    id: "subnet-splitter",
    name: "Subnet Splitter",
    description:
      "Carve a block into smaller ones. Divide and join like a whiteboard, or ask for a set number of equal subnets.",
    section: "networking",
    icon: "split",
    keywords: [
      "subnet",
      "split",
      "divide",
      "vlsm",
      "cidr",
      "supernet",
      "allocate",
      "carve",
      "davidc",
      "visual subnet calculator",
    ],
    api: {
      status: "live",
      method: "GET",
      params: [
        {
          name: "cidr",
          required: true,
          description: "The block to split, IPv4 or IPv6, e.g. 10.0.0.0/16.",
        },
        {
          name: "count",
          required: false,
          description:
            "Split into at least this many equal subnets. Rounded up to a power of two.",
        },
        {
          name: "prefix",
          required: false,
          description: "Split down to this prefix length, e.g. 20.",
        },
        {
          name: "divide",
          required: false,
          description:
            "An explicit division tree as 0s and 1s, the same encoding the browser panel produces.",
        },
        {
          name: "limit",
          required: false,
          description: "Rows per response. 1 to 4096. Default 256.",
        },
        { name: "offset", required: false, description: "Skip this many rows. Default 0." },
      ],
      resultKind: "rows",
      query: { cidr: "10.0.0.0/16", count: "4" },
    },
  },
  {
    id: "subnet-planner",
    name: "Subnet Planner",
    description:
      "Carve a block into named subnets sized to what each one has to hold, and see what is left over.",
    section: "networking",
    icon: "list-tree",
    keywords: [
      "subnet",
      "vlsm",
      "plan",
      "allocate",
      "carve",
      "cidr",
      "ipam",
      "vpc",
      "vlan",
      "design",
    ],
    api: {
      status: "live",
      method: "GET",
      params: [
        {
          name: "cidr",
          required: true,
          description: "The block to plan inside, IPv4 or IPv6, e.g. 10.0.0.0/16.",
        },
        {
          name: "need",
          required: true,
          description:
            "Comma-separated name:size list, e.g. pods:4000,mgmt:200,dmz:/26. Size is a host count or an explicit /prefix; the name is optional.",
        },
      ],
      resultKind: "rows",
      query: { cidr: "10.0.0.0/16", need: "pods:4000,mgmt:200,dmz:/26" },
    },
  },
  {
    id: "dns-lookup",
    name: "DNS Lookup",
    description:
      "Look up A, AAAA, MX, TXT, NS and more through Cloudflare's resolver, with TTLs and DNSSEC status.",
    section: "networking",
    icon: "radio-tower",
    keywords: [
      "dns",
      "lookup",
      "dig",
      "nslookup",
      "resolve",
      "a record",
      "aaaa",
      "mx",
      "txt",
      "cname",
      "ns",
      "spf",
      "dkim",
      "doh",
    ],
    serverOnly: true,
    api: {
      status: "live",
      method: "GET",
      params: [
        {
          name: "name",
          required: true,
          description: "The hostname to look up. A pasted URL is reduced to its host.",
        },
        {
          name: "type",
          required: false,
          description:
            "A, AAAA, CNAME, MX, TXT, NS, SOA, SRV, CAA, PTR, or all for the common set. Default A.",
        },
      ],
      resultKind: "rows",
      query: { name: "example.com", type: "A" },
    },
  },
  {
    id: "mail-check",
    name: "Mail Check",
    description:
      "SPF and DMARC for a domain, including whether SPF is over the ten-lookup budget receivers enforce.",
    section: "networking",
    icon: "mail-check",
    keywords: [
      "spf",
      "dmarc",
      "dkim",
      "email",
      "mail",
      "deliverability",
      "permerror",
      "spoofing",
      "dns",
      "txt",
    ],
    serverOnly: true,
    api: {
      status: "live",
      method: "GET",
      params: [
        {
          name: "domain",
          required: true,
          description: "The domain to check. A pasted URL or email address is reduced to its domain.",
        },
      ],
      resultKind: "rows",
      query: { domain: "github.com" },
    },
  },
  {
    id: "bandwidth",
    name: "Bandwidth & Transfer Time",
    description:
      "Convert between Mbps and MB/s, and work out how long a transfer takes — including the decimal/binary gap.",
    section: "networking",
    icon: "gauge",
    keywords: [
      "bandwidth",
      "mbps",
      "gbps",
      "throughput",
      "transfer",
      "download",
      "speed",
      "link rate",
      "bits",
      "bytes",
    ],
    api: {
      status: "live",
      method: "GET",
      params: [
        { name: "rate", required: true, description: "The link rate, e.g. 1." },
        { name: "unit", required: false, description: "bps, kbps, Mbps, Gbps, MB/s, MiB/s. Default Gbps." },
        { name: "size", required: false, description: "How much data to move, for a transfer time." },
        { name: "sizeUnit", required: false, description: "GB, GiB, TB, TiB and so on. Default GiB." },
        {
          name: "overhead",
          required: false,
          description: "Protocol overhead as a percentage. 6 is typical for TCP over Ethernet. Default 0.",
        },
      ],
      resultKind: "rows",
      query: { rate: "1", unit: "Gbps", size: "1", sizeUnit: "TiB", overhead: "6" },
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
      resultKind: "text",
    },
  },

  // ----------------------------------------------------------- data format
  {
    id: "base64",
    name: "Base64 Encode / Decode",
    description:
      "Encode text to base64 or decode it back. Works out which way round you meant, or you can say.",
    section: "data-format",
    icon: "binary",
    keywords: ["base64", "encode", "decode", "b64", "base64url", "atob", "btoa"],
    bodyInput: true,
    api: {
      status: "live",
      method: "POST",
      params: [
        { name: "body", required: true, description: "The text to convert, as the raw request body." },
        {
          name: "mode",
          required: false,
          description: "auto, encode or decode. Default auto, which guesses from the input.",
        },
        {
          name: "urlsafe",
          required: false,
          description: "Use the URL-safe alphabet and drop padding. Default false.",
        },
      ],
      resultKind: "fields",
      query: { mode: "encode" },
      bodyFile: "input.txt",
      bodySample: "hello world",
      sampleKey: "result",
    },
  },
  {
    id: "bytes-converter",
    name: "Bytes Converter",
    description:
      "Convert between B, kB, MB, GB and up, showing both the 1000-based and 1024-based answer.",
    section: "data-format",
    icon: "hard-drive",
    keywords: ["bytes", "kb", "mb", "gb", "tb", "kib", "mib", "gib", "size", "units", "convert"],
    api: {
      status: "live",
      method: "GET",
      params: [
        { name: "value", required: true, description: "The number to convert, e.g. 1.5." },
        { name: "from", required: true, description: "The unit it is in, e.g. GB or GiB." },
        {
          name: "to",
          required: false,
          description: "A single target unit. The whole table is returned if omitted.",
        },
      ],
      resultKind: "rows",
      query: { value: "1.5", from: "GB" },
    },
  },
  {
    id: "yaml-json",
    name: "YAML / JSON Converter",
    description:
      "Convert YAML to JSON or back again, with the parse error and its line if it will not parse.",
    section: "data-format",
    icon: "file-code",
    keywords: ["yaml", "json", "yml", "convert", "kubernetes", "compose", "manifest"],
    bodyInput: true,
    api: {
      status: "live",
      method: "POST",
      params: [
        { name: "body", required: true, description: "The document to convert, as the raw request body." },
        {
          name: "to",
          required: false,
          description: "json, yaml, or auto to convert to whichever it is not. Default auto.",
        },
        { name: "indent", required: false, description: "Spaces per level, 0 to 8. Default 2." },
      ],
      resultKind: "text",
      bodyFile: "config.yaml",
      bodySample: "name: trutools\nports:\n  - 3000",
    },
  },
  {
    id: "duration",
    name: "Duration Converter",
    description:
      "Move between seconds, 1h30m, systemd time spans and ISO 8601 — whichever form the config file wants.",
    section: "data-format",
    icon: "hourglass",
    keywords: ["duration", "seconds", "timespan", "systemd", "iso8601", "humanise", "timeout", "interval"],
    api: {
      status: "live",
      method: "GET",
      params: [
        {
          name: "value",
          required: true,
          description: "A number of seconds, or a duration like 1h30m, 2h 30min or PT1H30M.",
        },
      ],
      resultKind: "fields",
      query: { value: "1h30m" },
      sampleKey: "seconds",
    },
  },
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
      resultKind: "fields",
      query: { value: "1754870400", tz: "Europe/London" },
      sampleKey: "epoch_seconds",
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
      resultKind: "text",
      query: { indent: "2" },
      bodyFile: "data.json",
      bodySample: '{"b":2,"a":1}',
    },
  },

  // ------------------------------------------------------------------ text
  {
    id: "case-converter",
    name: "Case Converter",
    description:
      "camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE and more, all at once or one at a time.",
    section: "text",
    icon: "case-sensitive",
    keywords: ["case", "camel", "pascal", "snake", "kebab", "constant", "title", "slug", "identifier"],
    api: {
      status: "live",
      method: "GET",
      params: [
        { name: "text", required: true, description: "The text to convert." },
        {
          name: "to",
          required: false,
          description:
            "camel, pascal, snake, kebab, constant, title, sentence, dot, path, lower or upper. All are returned if omitted.",
        },
      ],
      resultKind: "fields",
      query: { text: "hello world example" },
      sampleKey: "camelcase",
    },
  },
  {
    id: "lorem-ipsum",
    name: "Lorem Ipsum",
    description: "Placeholder text by paragraph, sentence or word count.",
    section: "text",
    icon: "pilcrow",
    keywords: ["lorem", "ipsum", "placeholder", "filler", "dummy", "text", "mock"],
    api: {
      status: "live",
      method: "GET",
      params: [
        {
          name: "unit",
          required: false,
          description: "paragraphs, sentences or words. Default paragraphs.",
        },
        { name: "count", required: false, description: "How many. Default 3." },
        {
          name: "classic",
          required: false,
          description: 'Start with the traditional "Lorem ipsum dolor sit amet". Default true.',
        },
      ],
      resultKind: "text",
      query: { unit: "paragraphs", count: "2" },
    },
  },
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
      resultKind: "text",
      query: { op: "join", sep: "," },
      bodyFile: "hosts.txt",
      bodySample: "web-01\nweb-02\ndb-01",
    },
  },
  {
    id: "file-permissions",
    name: "File Permissions",
    description:
      "Convert between 755 and rwxr-xr-x in either direction, with the owner, group and other breakdown.",
    section: "system",
    icon: "shield",
    keywords: ["chmod", "permissions", "octal", "symbolic", "umask", "setuid", "setgid", "sticky", "rwx"],
    api: {
      status: "live",
      method: "GET",
      params: [
        { name: "mode", required: false, description: "Octal mode, 3 or 4 digits, e.g. 755 or 4755." },
        { name: "symbolic", required: false, description: "Symbolic mode, e.g. rwxr-xr-x." },
      ],
      resultKind: "fields",
      query: { mode: "4755" },
      sampleKey: "symbolic",
    },
  },
  {
    id: "systemd-lint",
    name: "Systemd Unit Linter",
    description:
      "Check a unit file for structural mistakes: unknown sections, misplaced directives, a Service with no ExecStart.",
    section: "system",
    icon: "server-cog",
    keywords: ["systemd", "unit", "service", "timer", "socket", "lint", "validate", "execstart"],
    bodyInput: true,
    api: {
      status: "live",
      method: "POST",
      params: [
        { name: "body", required: true, description: "The unit file, as the raw request body." },
      ],
      resultKind: "rows",
      bodyFile: "app.service",
      bodySample: "[Unit]\nDescription=Example\n\n[Service]\nExecStart=/usr/bin/true",
    },
  },
  {
    id: "cron-explain",
    name: "Cron Explainer",
    description:
      "Say what a cron expression means in English and when it next runs — including the day-of-month/day-of-week trap.",
    section: "system",
    icon: "calendar-clock",
    keywords: ["cron", "crontab", "schedule", "expression", "next run", "timer", "@daily", "quartz"],
    api: {
      status: "live",
      method: "GET",
      params: [
        { name: "expr", required: true, description: "A 5-field cron expression, or a macro like @daily." },
        { name: "count", required: false, description: "How many upcoming runs to list. 1 to 50. Default 5." },
        { name: "tz", required: false, description: "IANA timezone the schedule runs in. Default UTC." },
      ],
      resultKind: "fields",
      query: { expr: "0 3 * * 1", count: "5", tz: "Europe/London" },
      sampleKey: "meaning",
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
