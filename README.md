# trutools

Simple IT tools, in the browser or over an API — at
**[tools.truvibe.dev](https://tools.truvibe.dev)**.

Twenty-eight small utilities of the sort you otherwise keep a browser tab, a
half-remembered `python3 -c` and a dubious ad-funded website open for. Subnet
maths, timestamp conversion, hashes, SSH key inspection, cron explanations.

The point is that each one has **two front doors onto the same function**:

```console
$ curl tools.truvibe.dev/ip
203.0.113.42

$ curl 'tools.truvibe.dev/subnet-inspector?cidr=10.0.0.0/22'
Network          10.0.0.0/22
Netmask          255.255.252.0 (/22)
Wildcard         0.0.3.255
Broadcast        10.0.3.255
First usable     10.0.0.1
Last usable      10.0.3.254
Usable hosts     1,022
Total addresses  1,024
Type             Private (RFC 1918)

$ curl 'tools.truvibe.dev/file-permissions?mode=4755'
Octal          4755
Octal (short)  755
Symbolic       rwsr-xr-x
ls -l          -rwsr-xr-x
Owner          7 — read, write, execute
Group          5 — read, execute
Other          5 — read, execute
Special bits   setuid
chmod          chmod 755 <file>
```

No account, no key, no JSON envelope you have to unwrap before you can use the
answer. Plain text in, plain text out, rate limited per IP — the model
[icanhazip](https://icanhazip.com) has been quietly proving for years.

The browser side is the same tools as a filterable card grid. Open a card and it
expands in place with two tabs: **Tool** for the interactive version, **API** for
a ready-to-paste snippet in curl, Go, JavaScript, PowerShell, Python,
Ruby or Rust.

## The tools

| Crypto | Networking | Data Format |
|---|---|---|
| Password Generator | Subnet Inspector | Base64 Encode / Decode |
| UUID Generator | Subnet Splitter | Bytes Converter |
| Token Generator | Subnet Planner | YAML / JSON Converter |
| Hash Generator | DNS Lookup | Duration Converter |
| JWT Decoder | Mail Check (SPF + DMARC) | Timestamp Converter |
| SSH Key Inspector | Bandwidth & Transfer Time | Beautify JSON |
| SSH Keypair Generator | What Is My IP | |
| Certificate Reader | | |

| Text | System |
|---|---|
| Case Converter | Disk Space Calculator |
| Lorem Ipsum | File Permissions |
| Text Tool | Systemd Unit Linter |
| | Cron Explainer |

[`docs/tools.md`](docs/tools.md) covers what each one does and where the
interesting edges are. `curl tools.truvibe.dev/api/v1` prints the same list with
every parameter, so the API documents itself.

## Running it locally

Node 24+ and pnpm.

```bash
pnpm install
cp .env.example .env.local
pnpm dev                      # binds 0.0.0.0, so it is reachable on the LAN
```

Then <http://localhost:3000>. Without `REDIS_URL` the app falls back to an
in-process limiter and says so in the log — fine for local work, wrong for
anything shared, since it resets on restart and is per-replica. Point
`REDIS_URL` at any Redis you already have if you want the real path.

`docker compose up -d` is **not** part of this: `docker-compose.yml` is the
deployment stack, and running it builds the whole app image.

```bash
pnpm build && pnpm start      # production build
pnpm lint
```

## Docs

| | |
|---|---|
| [`docs/tools.md`](docs/tools.md) | What each tool does, and the edges worth knowing |
| [`docs/api.md`](docs/api.md) | The API: formats, errors, rate limits, every endpoint |
| [`docs/architecture.md`](docs/architecture.md) | How the codebase fits together |
| [`docs/self-hosting.md`](docs/self-hosting.md) | Running your own copy |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Adding a tool, and the house style |
| [`SECURITY.md`](SECURITY.md) | Reporting a vulnerability, and what the service does with your input |

## How it is built

Next.js 16 (App Router) · React 19 · Tailwind v4 · shadcn with
[`@glasscn`](https://glasscn-components.vercel.app) on Base UI · Motion ·
ioredis.

One idea holds the whole thing up: **a tool is a function, and both front doors
call it.** `lib/tools/impl/` holds the logic, the browser panel imports it
directly, the route handler imports the same thing. The browser and `curl`
cannot disagree about what a tool does, because there is only one
implementation to disagree with.

Most tools therefore run entirely in the page — nothing is sent anywhere.
Four cannot: the certificate reader needs `node:crypto` for X.509, DNS lookup
and mail check need a resolver, and the IP echo can only be answered by the
thing receiving the request. Those four call this same public API, so the page
shows byte-for-byte what a `curl` user sees.

SSH keypairs are generated in the browser with WebCrypto, so the private key
never crosses the network. See [`docs/architecture.md`](docs/architecture.md)
for the rest.

## Licence

[MIT](LICENSE).
