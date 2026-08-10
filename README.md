# trutools

Simple IT tools, at [trutools.truvibe.dev](https://trutools.truvibe.dev).

Two front doors onto the same set of tools:

- **A web UI** — a filterable card grid, sections for Crypto / Networking / Data
  Format / Text, and a Dynamic-Island-style pill in the navbar that doubles as
  the toast surface.
- **A public plain-text API** — `curl trutools.truvibe.dev/api/v1/ip`. Plain text
  in, plain text out, rate limited per IP. Modelled on icanhazip.

## Status

All ten tools work, in the browser and over the API. Cards sit four to a row;
opening one slides a full-width panel in beneath its row with two tabs — **Tool**
for the interactive version and **API** for the curl equivalent.

Both surfaces call the same function. `lib/tools/impl/` holds the logic, the
panel imports it directly and the route handler imports it too, so the browser
and `curl` cannot disagree about what a tool does.

Two tools need `node:crypto` and so cannot run in the browser — OpenSSH key
encoding and X.509 parsing. Their panels call our own public API, which means
the page shows byte-for-byte what a `curl` user sees.

## Running it

```bash
pnpm install
docker compose up -d          # local Redis on :6380 for the rate limiter
cp .env.example .env.local
pnpm dev                      # binds 0.0.0.0 so it is reachable on the LAN
```

Without `REDIS_URL` the app falls back to an in-process rate limiter and logs a
warning. Fine for a quick `pnpm dev`; wrong for production, since it resets on
restart and is per-replica.

```bash
pnpm build && pnpm start      # production build
pnpm lint
```

## Adding a tool

1. **`lib/tools/impl/<tool>.ts`** — the logic. Return a `ToolResult`
   (`lines`, `fields` or `text`) and throw `ToolInputError` for bad input.
   Keep it isomorphic unless it genuinely needs Node; if it does, put it under
   `impl/server/` and mark the tool `serverOnly`.
2. **`lib/tools/registry.ts`** — the `Tool` entry. This alone gives you a card,
   search coverage, and an entry in the `/api/v1` index.
3. **`lib/api/handlers.ts`** — parse the query params and call your function.
4. **`components/tools/panels/`** — the interactive panel, registered in
   `panels/index.tsx`.

Keep `registry.ts` free of React and lucide imports — the route handlers import
it. Icons are string keys resolved by `components/tools/icon-map.tsx`.

Plain-text output is generated from the `ToolResult` by `renderText` in
`lib/tools/result.ts`. Single-line fields are printed as an aligned column;
multi-line ones (PEM blocks, SAN lists) get their own flush-left block, so
`curl .../ssh-keypair-generator | sed -n '/BEGIN/,/END/p' > id_ed25519`
produces a key `ssh-keygen` will actually load.

## API

```
GET  /api/v1                          plain-text index of every endpoint
GET  /api/v1/ip                       the caller's public IP
GET  /api/v1/password-generator       ?length=32&count=3&symbols=false
GET  /api/v1/uuid-generator           ?version=7&count=5
GET  /api/v1/token-generator          ?bytes=32&encoding=hex&prefix=sk_live
GET  /api/v1/ssh-keypair-generator    ?type=ed25519&comment=laptop
GET  /api/v1/subnet-calculator        ?cidr=10.0.0.0/22
GET  /api/v1/timestamp-converter      ?value=1754870400&tz=Europe/London
POST /api/v1/cert-reader              PEM certificate as the body
POST /api/v1/json-beautify            ?indent=2&sort=true
POST /api/v1/text-tool                ?op=join&sep=,
GET  /api/health                      liveness, not rate limited
```

`GET /api/v1` lists all of this with every parameter, so the API documents
itself the way icanhazip does.

Responses are `text/plain` by default. Add `?format=json` or `?format=xml`, or
send an `Accept` header of `application/json` / `application/xml`, for something
a script can parse — errors come back in the same format you asked for.

```
$ curl 'trutools.truvibe.dev/api/v1/subnet-calculator?cidr=10.0.0.0/22&format=json'
{ "tool": "subnet-calculator", "result": { "network": "10.0.0.0/22", ... } }
```

Field labels become snake_case keys in JSON and element names in XML; XML keeps
the human label as an attribute so nothing is lost.

Each tool's API tab in the UI generates a ready-to-paste snippet for curl,
PowerShell, Python, JavaScript and Go, with a second picker for what the
snippet leaves you holding. For curl those are the wire formats; for every
other language they are native shapes:

| | |
|---|---|
| PowerShell | text, array, hashtable, PSCustomObject |
| Python | text, list, tuple, set, dict, items |
| JavaScript | text, array, Set, object, Map, entries |
| Go | text, `[]string`, `map[string]string` |

Which shapes appear depends on what the tool returns — a list of UUIDs has no
sensible hashtable form, and a set of subnet readings has no sensible tuple
form, so `outputsFor()` in `lib/tools/snippets.ts` filters by result kind.

Rate limiting is a sliding-window log in Redis, evaluated atomically in one Lua
round trip. Defaults to 60 requests per 60 seconds per IP, tunable with
`RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_SEC`. Every response carries
`X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`; a 429 adds
`Retry-After`.

Two notes on behaviour that are deliberate:

- **The reported IP and the rate-limit key are different.** `/api/v1/ip` echoes
  the *leftmost* `X-Forwarded-For` entry, which is what a caller behind a proxy
  expects to see. The limiter keys on the *rightmost* entry — the hop our own
  proxy observed — because the leftmost value is client-supplied and would
  otherwise make the limiter trivial to bypass. See `lib/api/client-ip.ts`.
- **The limiter fails open.** If Redis is unreachable, requests are allowed
  rather than refused. A public utility API going down because its rate limiter
  is sick is a worse outcome than a brief window without limiting.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · shadcn with
[`@glasscn`](https://glasscn-components.vercel.app/) on Base UI · Motion ·
ioredis.

The navbar island is adapted from `@smoothui/dynamic-island` — the registry
ships a demo (fixed height, hardcoded scenes, view-switcher buttons), so only
its motion recipe survives. See `components/island/dynamic-island.tsx`.

## Deploying

Coolify builds the `Dockerfile` directly — a multi-stage build on
`node:24-alpine` producing a `output: "standalone"` runner on port 3000, running
as non-root, with `/api/health` as the healthcheck.

Set `REDIS_URL` in the Coolify environment and point it at a Redis resource.
