# trutools

Simple IT tools, at [trutools.truvibe.dev](https://trutools.truvibe.dev).

Two front doors onto the same set of tools:

- **A web UI** — a filterable card grid, sections for Crypto / Networking / Data
  Format / Text, and a Dynamic-Island-style pill in the navbar that doubles as
  the toast surface.
- **A public plain-text API** — `curl trutools.truvibe.dev/api/v1/ip`. Plain text
  in, plain text out, rate limited per IP. Modelled on icanhazip.

## Status

This is a scaffold. The **UI shell, search, and API layer are real**; the tools
themselves are not implemented yet. Cards expand to show the API contract for
the tool they represent, and every endpoint except `/api/v1/ip` returns `501`.

`/api/v1/ip` is wired end to end and proves the whole pipeline.

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

Everything is driven off one registry, so a tool is three edits:

1. **`lib/tools/registry.ts`** — add the `Tool` entry. This alone gives you a
   card, search coverage, and an entry in the `/api/v1` index.
2. **`lib/api/handlers.ts`** — add a handler keyed by the tool's `id`. Throw
   `BadRequestError` for a 400; anything returned is sent as `text/plain`.
3. Flip that tool's `api.status` to `"live"` and drop its controls into
   `components/tools/tool-panel.tsx`.

Keep `registry.ts` free of React and lucide imports — the route handlers import
it. Icons are string keys resolved by `components/tools/icon-map.tsx`.

## API

```
GET  /api/v1              plain-text index of every endpoint
GET  /api/v1/ip           the caller's public IP
GET  /api/v1/<tool>       501 until the tool is implemented
GET  /api/health          liveness, not rate limited
```

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
