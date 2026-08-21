# Self-hosting

The hosted site is rate limited because it is one small server on someone's
hobby budget. If that limit is in your way, run your own — it is a Dockerfile
and one environment variable.

## Docker

The repo ships a multi-stage `Dockerfile`: `node:24-alpine`, Next's
`output: "standalone"` (a `server.js` plus only the `node_modules` it actually
needs), running as a non-root user on port 3000, with `/api/health` wired up as
the container healthcheck.

```bash
docker build \
  --build-arg NEXT_PUBLIC_SITE_URL=https://tools.example.com \
  -t trutools .

docker run -d -p 3000:3000 \
  -e REDIS_URL=redis://redis:6379 \
  -e NEXT_PUBLIC_SITE_URL=https://tools.example.com \
  trutools
```

**`NEXT_PUBLIC_SITE_URL` must be set at build time.** Next inlines
`NEXT_PUBLIC_*` into the client bundle during `pnpm build`, so setting it only
at runtime leaves every generated code snippet pointing at `tools.truvibe.dev`.
Pass it as a `--build-arg` *and* keep it in the runtime environment. On Coolify
that means marking it as a **build** variable, not just a runtime one.

Everything else is read at request time and only needs a restart.

### With Redis, in one stack

`docker-compose.yml` builds the same image and puts a Redis beside it, already
wired together. It publishes **no ports** — it expects a reverse proxy on the
same Docker network, which is what Coolify provides. Standalone, add an override
that publishes one:

```bash
cat > compose.override.yml <<'EOF'
services:
  app:
    ports:
      - "3000:3000"
EOF

NEXT_PUBLIC_SITE_URL=https://tools.example.com \
  docker compose -f docker-compose.yml -f compose.override.yml up -d --build
```

## Environment

| Variable | Default | |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://tools.truvibe.dev` | Your public origin. **Build time.** Feeds metadata, the `/api/v1` index, error messages and every snippet |
| `REDIS_URL` | unset | Backs the rate limiter. Without it, an in-process fallback |
| `RATE_LIMIT_MAX` | `60` | Requests per window, per IP |
| `RATE_LIMIT_WINDOW_SEC` | `60` | Window length in seconds |
| `CLIENT_IP_HEADER` | unset | A header to trust for the caller's address. **Read the warning below** |
| `IP_DEBUG` | unset | `1` exposes `/ip?debug` in production. On automatically outside it |

`NEXT_PUBLIC_SITE_URL` is the only place the domain is written down. It feeds
`lib/site.ts`, and everything else reads from there.

## Redis

Optional, and strongly recommended for anything public.

Without `REDIS_URL` the limiter falls back to an in-process one that **resets on
restart and is per-replica** — so a rolling deploy clears everyone's budget, and
two replicas mean double the limit. It logs a warning saying so.

`docker-compose.yml` is the deployment stack and runs one for you, unpublished
and reachable only from the app container as `redis://redis:6379`. It builds the
app from the `Dockerfile` rather than pulling an image, because
`NEXT_PUBLIC_SITE_URL` has to reach the build as an argument — still true under
compose, and still the setting that fails silently.

On Coolify that means the **Docker Compose** build pack, at the default Docker
Compose Location of `/docker-compose.yml`. Leave the compose file's `networks:`
alone — there isn't one, deliberately. A custom network puts containers on two
networks and Traefik starts choosing the wrong address, which surfaces as
intermittent 504s.

`pnpm dev` does not use that stack. Point `REDIS_URL` at any Redis you already
have, or leave it unset and take the fallback.

Redis stores one sorted set per caller IP, holding recent request timestamps,
expiring after the window. Addresses, no payloads. Nothing needs persisting —
losing the lot costs one window of rate limit state, so `--save ""` is a
perfectly reasonable way to run it.

The limiter **fails open**: if Redis is unreachable, requests are allowed. Alert
on it if you care, because a broken Redis is silent from the outside.

## Getting the caller's IP right

This is the part that goes wrong, and `/ip` is where it shows.

By default the caller's address is the **rightmost publicly routable entry in
`X-Forwarded-For`**. Right-to-left skips your own private proxy and container
hops, and it cannot be moved by a spoofed header, because a caller can only
prepend entries on the left. For a plain reverse proxy that appends correctly,
this needs no configuration and no trust list.

**It stops working behind a CDN**, in two different ways:

- **CDN proxying straight through to your origin.** The rightmost public entry
  is the CDN's edge, not the visitor. Everyone shows up as Cloudflare.
- **TLS terminating at the origin** — an L4 passthrough, or a tunnel in
  between. Nothing on that path *can* add `X-Forwarded-For`, and a proxy like
  Traefik will rewrite the incoming one from the tunnel peer because that peer
  is not in its trusted list. The chain ends up holding **only private hops**,
  and `/ip` reports something like `10.31.31.2`.

Both are fixed the same way — name the header the CDN sets, which rides through
untouched:

```
CLIENT_IP_HEADER=cf-connecting-ip
```

> **A trusted header is only safe if your origin cannot be reached directly.**
>
> With `CLIENT_IP_HEADER` set, anything that can talk to the origin can set that
> header and become any address it likes — spoofing `/ip` and choosing its own
> rate limit bucket.
>
> Restrict the origin to your CDN's published ranges, or leave the variable
> unset. Without a CDN in front, always leave it unset.

### Diagnosing it

```console
$ curl 'https://tools.example.com/ip?debug'
```

lists every forwarding header that arrived, marks each `X-Forwarded-For` entry
public or private, and says explicitly when a header like `cf-connecting-ip` is
present but going unused — which is the usual "why is this wrong" answer.

`cookie` and `authorization` are redacted. It is on automatically outside
production; in production it needs `IP_DEBUG=1`, and it is worth turning back
off afterwards.

## Reverse proxy

Nothing special is required. No sticky sessions, no websockets, no special
paths — it is stateless HTTP, and the only shared state is Redis.

Two things to leave alone:

- **Don't cache API responses.** They already send `Cache-Control: no-store`,
  and some of them are secrets. Serving a cached password to a second caller
  would be the worst bug this project could have.
- **Don't strip `X-Forwarded-For`**, and if your proxy rewrites rather than
  appends it, either fix that or use `CLIENT_IP_HEADER`.

Rate limiting is done in the application, so you do not need proxy-level limits
as well — though nothing stops you adding them for the static assets.

## Scaling

It is CPU-bound only in short bursts and holds no state, so replicas scale
horizontally as long as they share one Redis. Without a shared Redis the limit
multiplies by the number of replicas.

Measured server cost per request, for a sense of scale: pure computation ~8 ms,
DNS lookups ~16 ms (the `type=all` queries run in parallel, so they are nearly
free), ed25519 keygen ~8 ms, RSA-2048 ~85 ms. RSA-4096 was the only expensive
one at ~713 ms, and moving it to WebCrypto brought it to ~29 ms.

## Running from source

If you would rather not use Docker:

```bash
pnpm install
pnpm build
NEXT_PUBLIC_SITE_URL=https://tools.example.com pnpm build   # it is baked in here
REDIS_URL=redis://localhost:6379 pnpm start
```

`pnpm start` binds `0.0.0.0:3000`. Put a TLS-terminating proxy in front of it.

Node 24+ is required — the tools use WebCrypto's Ed25519 support, which is not
available in older releases.
