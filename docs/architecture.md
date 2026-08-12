# Architecture

One idea holds the whole thing up:

> **A tool is a function. Both front doors call it.**

`lib/tools/impl/<tool>.ts` exports a function. The browser panel imports it and
calls it directly. The API route handler imports the same function and calls it
too. The browser and `curl` cannot disagree about what a tool does, because
there is only one implementation to disagree with.

Everything below is in service of that.

## Layout

```
lib/tools/
  registry.ts         the spine — every tool, described as data
  result.ts           the ToolResult union, and plain-text rendering
  format.ts           text / json / xml rendering, and format negotiation
  search.ts           the search filter
  snippets.ts         generates the curl/PowerShell/Python/JS/Go examples
  impl/               the tools themselves, one file each
    server/           the four that genuinely need Node or the network

lib/api/
  tool-route.ts       shared dispatch for both API paths
  handlers.ts         query-param parsing, one entry per tool
  respond.ts          status codes, headers, CORS, error bodies
  ratelimit.ts        the sliding-window Lua script
  rate-limit-config.ts  the numbers, split out so the UI can read them
  redis.ts            connection, with an in-process fallback
  client-ip.ts        working out who is calling

app/
  page.tsx            the card grid
  api/v1/route.ts     the self-documenting index
  api/v1/[tool]/route.ts   the versioned endpoint
  api/health/route.ts liveness

components/tools/
  panels/             the interactive UI, grouped by section
  icon-map.tsx        string key -> lucide component

proxy.ts              rewrites /<tool> onto /api/v1/<tool>
```

## The registry is the spine

`lib/tools/registry.ts` is pure data — no React, no lucide, no imports that
drag a UI framework into a server bundle. Icons are **string keys**, resolved
later by `components/tools/icon-map.tsx`.

That one file drives four things:

- the card grid and its sections
- the search filter, including `keywords`
- the `/api/v1` index, so the API documents itself
- dispatch — `proxy.ts` matches incoming paths against the known ids

Add an entry and you get all four. That is why the registry entry, not the
implementation, is step one when adding a tool.

## ToolResult

Every tool returns one of four shapes:

```ts
| { kind: "lines";  lines: string[] }
| { kind: "fields"; fields: { label: string; value: string }[] }
| { kind: "text";   text: string }
| { kind: "rows";   … }
```

The kind is declared in the registry as well as returned by the function,
because it does double duty: `format.ts` uses it to render text, JSON and XML,
and `snippets.ts` uses it to decide which native output shapes a generated code
example should offer. A `lines` result has no sensible Python `dict` form, so
that option is never shown.

### One detail that matters more than it looks

`renderText` prints single-line fields as an aligned column, but gives a
**multi-line value its own flush-left block** rather than indenting it to match.

That is not cosmetic. An indented PEM body is not a key `ssh-keygen` will load.
Because this is what makes the following work, it is a rule rather than a
preference:

```bash
curl .../ssh-keypair-generator | sed -n '/BEGIN/,/END/p' > id_ed25519
```

## Two URLs, one implementation

```
/<tool>            short form, promoted by the snippets
/api/v1/<tool>     versioned form
```

`proxy.ts` — Next 16's replacement for the deprecated `middleware.ts` — rewrites
the first onto the second, but **only for paths matching a known tool id**.
Everything else falls through untouched, so a mistyped URL still gets the real
404 page.

This is deliberately not an `app/[tool]/route.ts` catch-all. A root-level
dynamic route would swallow every unmatched path on the site and answer it with
a plain-text API error, and `notFound()` inside a Route Handler returns an empty
body rather than rendering the 404 page — worse still.

`lib/api/tool-route.ts` is the single dispatch both paths reach, so rate
limiting, format negotiation and error bodies cannot drift apart between them.
The order inside it is deliberate:

1. **Resolve the format first**, so even a 429 or a 404 comes back in the format
   the caller asked for.
2. **Rate limit before dispatch**, so unknown and unimplemented endpoints are
   limited too and cannot be used as a free way to probe the service.
3. Look up the tool, then the handler, then run it.
4. `BadRequestError` becomes a 400; anything else is logged and becomes a 500.

**Tool ids share a namespace with pages.** Next resolves static segments before
dynamic ones, so a page at `/search` would silently shadow a tool with that id.
Worth remembering before adding either.

## Client and server

Most tools are **isomorphic** — no `node:` imports, no `window` — so the same
module runs in the browser and on the server. That is what makes the two front
doors trustworthy.

Four tools cannot be, and live in `lib/tools/impl/server/`:

| Tool | Needs |
|---|---|
| `cert-reader` | `node:crypto` for X.509 |
| `dns-lookup` | a resolver |
| `mail-check` | a resolver |
| `ip` | the incoming request itself |

They are marked `serverOnly` in the registry, and their panels call this same
public API instead of computing locally — so the browser shows byte-for-byte
what a `curl` user sees.

`dns-lookup` and `mail-check` share one DoH transport in
`impl/server/doh.ts`. The endpoint host is a **constant**, and the user-supplied
part is a domain name in a query string, never a URL. That is the SSRF guard:
there is no address for a caller to substitute.

## Crypto in the browser

SSH keypair generation used to be `generateKeyPairSync`. RSA-4096 cost **~713 ms
of synchronous CPU** — and Node's event loop is single-threaded, so four
concurrent requests made every other endpoint on the site hang for six seconds.

It is now WebCrypto, which is async and isomorphic: **~29 ms**, and the browser
path never sends the private key anywhere.

That meant hand-writing the OpenSSH wire format — `sshString`, `sshMpint`, the
`openssh-key-v1` container (PROTOCOL.key and RFC 4253) — because WebCrypto
gives you PKCS#8 and SPKI, and OpenSSH wants neither.

MD5 is hand-written for the same category of reason: Web Crypto deliberately
omits it, and real systems still emit MD5 checksums you sometimes have to match.

## Rate limiting

A **sliding-window log**: a Redis sorted set per caller, holding timestamps,
trimmed and evaluated atomically in a single Lua round trip. One network
round trip per request, no read-modify-write race.

A blocked request is deliberately **not** recorded, so hammering a 429 does not
extend your own lockout.

Two decisions worth knowing:

- **It fails open.** Redis unreachable means requests are allowed. A public
  utility API going dark because its limiter is sick is the worse outcome.
- `enableOfflineQueue: true` with a 1 s command timeout. The obvious-looking
  `false` produced a real bug: during the Redis handshake, commands threw
  instantly, the limiter failed open, and a burst sailed straight through a
  limit of five.

Without `REDIS_URL` there is an in-process fallback. It resets on restart and is
per-replica — fine for `pnpm dev`, wrong for anything shared.

## Working out who is calling

`lib/api/client-ip.ts`, and it is the fiddliest file in the project.

icanhazip reports the socket peer and ignores forwarding headers entirely. A
Next route handler **cannot see the socket peer**, so the same answer has to be
reconstructed from `X-Forwarded-For`:

> Scan the chain **from the right** and take the first publicly routable address.

Right-to-left skips our own proxy and container hops, which are all private. And
it cannot be moved by a spoofed header, because a caller can only *prepend*
entries on the left.

Behind a CDN that is not enough, and `CLIENT_IP_HEADER` names a header to trust
instead. `clientIp()` and `rateLimitKey()` share one resolution, so the address
you are shown is the address you are limited on.

`GET /ip?debug` dumps every forwarding header that arrived, marks each chain
entry public or private, and redacts `cookie` and `authorization`. It is on
outside production, and behind `IP_DEBUG=1` in it. See
[self-hosting](self-hosting.md#getting-the-callers-ip-right) for when you need
it.

## The UI

The card grid opens a tool **in place**: the cards on that row shift down and a
full-width panel slides in beneath them, with a toggle between the interactive
tool and the generated API example.

Panels drive themselves — output updates as input changes rather than waiting
for a submit button. `useToolRun` provides `run` for synchronous tools and
`runAsync` for the async ones, with the same error handling.

The navbar island is adapted from `@smoothui/dynamic-island`. The registry ships
a demo — fixed height, hardcoded scenes, view-switcher buttons — so only its
motion recipe survived; see `components/island/dynamic-island.tsx`. It doubles
as the toast surface and as the API health indicator, polling `/api/health` and
showing the real status code.

Glass styling comes from [`@glasscn`](https://glasscn-components.vercel.app),
which is built on **Base UI**, not Radix — worth knowing before reaching for a
Radix-shaped API in a component.
