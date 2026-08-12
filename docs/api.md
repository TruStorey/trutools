# The API

Every tool on the site is also an HTTP endpoint. Plain text in, plain text out,
no key, no account, no JSON envelope in the way.

```console
$ curl tools.truvibe.dev/ip
203.0.113.42
```

That is the whole design: the answer, on stdout, ready to pipe.

## Base URLs

Each tool answers on **two paths**, which are the same endpoint:

```
https://tools.truvibe.dev/<tool>            short form — what the snippets use
https://tools.truvibe.dev/api/v1/<tool>     versioned form
```

The short form is a rewrite handled in `proxy.ts`, matched against the known
tool ids. The versioned form is kept so a future `/api/v2` has somewhere to live
without breaking anything already written down in someone's script.

It is deliberately **not** a root `[tool]` catch-all route. A catch-all would
swallow every mistyped URL on the site and answer it with a plain-text API error
instead of the 404 page.

```console
$ curl tools.truvibe.dev/api/v1
```

prints the complete index — every endpoint with every parameter. The API
documents itself, so that listing is authoritative if it ever disagrees with
this page.

## Discovery and health

| | |
|---|---|
| `GET /api/v1` | Plain-text index of every endpoint and parameter |
| `GET /api/health` | Liveness. Returns `ok`. **Not** rate limited |

`/api/health` deliberately does not touch Redis — a Redis blip degrades rate
limiting, which fails open, and should not make an orchestrator kill the
container. It also advertises the deployment's limit in its **headers**
(`X-RateLimit-Limit`, `X-RateLimit-Window`), which is how the site's own API
dialog states a number that matches what is really being enforced:

```console
$ curl -sI tools.truvibe.dev/api/health | grep -i ratelimit
x-ratelimit-limit: 60
x-ratelimit-window: 60
```

## Output formats

Plain text by default. Ask for something parseable with `?format=`, or with an
`Accept` header:

```console
$ curl 'tools.truvibe.dev/subnet-calculator?cidr=10.0.0.0/22&format=json'
$ curl -H 'Accept: application/xml' 'tools.truvibe.dev/subnet-calculator?cidr=10.0.0.0/22'
```

| `format` | Content-Type |
|---|---|
| `text` (default) | `text/plain; charset=utf-8` |
| `json` | `application/json; charset=utf-8` |
| `xml` | `application/xml; charset=utf-8` |

An explicit `?format=` wins over `Accept`.

In JSON, field labels become `snake_case` keys — `First usable` becomes
`first_usable`. In XML they become element names, and the human label is kept as
an attribute so nothing is lost in translation.

Every response ends with a trailing newline, including JSON and XML. No parser
minds, and it means `$(curl ...)` and `read` behave the way anyone coming from
icanhazip expects.

## Errors

Errors come back **in the format you asked for**, so a script does not have to
switch parsers when something goes wrong.

| Status | Means |
|---|---|
| `400` | Your input. The message says what was wrong with it |
| `404` | No tool by that name. Points you at `/api/v1` |
| `429` | Rate limited. Carries `Retry-After` |
| `500` | Our fault. The detail is in the server log, not the response |
| `501` | A tool that is listed but not wired up yet |

In plain text the body is just the message — the status is in the status line,
where it already was:

```console
$ curl -i 'tools.truvibe.dev/file-permissions?mode=999'
HTTP/2 400
content-type: text/plain; charset=utf-8

"999" is not a valid octal mode — expected 3 or 4 digits, each 0-7, e.g. 755 or 4755
```

`?format=json` gives `{ "error": "…", "status": 400 }`, and `?format=xml` gives
`<error status="400">…</error>`.

Note that the **rate limit is applied before dispatch**, so unknown endpoints
are limited too. Probing for endpoints costs the same as using them.

## Rate limits

**60 requests per 60 seconds, per IP**, on the hosted deployment. Self-hosted
copies set their own with `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_SEC`; the
`X-RateLimit-*` headers on `/api/health` say what a given deployment is
actually running.

Every response carries the state:

| Header | |
|---|---|
| `X-RateLimit-Limit` | Requests allowed per window |
| `X-RateLimit-Remaining` | Left in the current window |
| `X-RateLimit-Reset` | Unix seconds when the oldest request falls out |
| `Retry-After` | On a `429` only. Whole seconds |

It is a **sliding window log** — timestamps in a Redis sorted set, evaluated
atomically in a single Lua round trip. A blocked request is *not* recorded, so
hammering a `429` does not extend your own lockout.

Two behaviours worth knowing:

- **The limiter fails open.** If Redis is unreachable, requests are allowed
  rather than refused.
- **The key is your IP as the server resolves it** — the rightmost publicly
  routable entry in `X-Forwarded-For`. Behind a CDN that is configurable; see
  [self-hosting](self-hosting.md#getting-the-callers-ip-right).

If you need more than this, self-host. It is one `docker compose` away and the
limit is a config value.

## Other response headers

- `Access-Control-Allow-Origin: *` — it is a public read-only API; call it from
  a browser if you like.
- `Cache-Control: no-store` — the answers are per-request, and some of them are
  secrets.
- `X-Robots-Tag: noindex, nofollow` — tool endpoints sit at root-level URLs,
  which crawlers would happily index. A generated password in a search result
  would be a bad day.

## POST endpoints

Eight tools take a document rather than query parameters. Send it as the **raw
request body** — no form encoding, no JSON wrapper:

```console
$ curl --data-binary @cert.pem tools.truvibe.dev/cert-reader
$ curl --data-binary @app.service tools.truvibe.dev/systemd-lint
$ printf 'hello world' | curl --data-binary @- 'tools.truvibe.dev/hash-generator?algo=sha256'
```

Use `--data-binary`, not `-d`. Plain `-d` strips newlines, which quietly
destroys a PEM block or a unit file.

Query parameters still apply alongside the body — `?algo=`, `?to=`, `?indent=`
and so on.

## Endpoint reference

Parameters are optional unless marked **required**.

### Crypto

| Endpoint | Parameters |
|---|---|
| `GET /password-generator` | `length` 4–256, default 24 · `count` 1–100 · `lowercase` · `uppercase` · `digits` · `symbols` · `exclude-ambiguous` |
| `GET /uuid-generator` | `version` 4 or 7, default 4 · `count` 1–1000 · `uppercase` · `hyphens` |
| `GET /token-generator` | `bytes` 8–256, default 32 · `encoding` `base64url`\|`hex`\|`base58` · `prefix` · `count` 1–100 |
| `POST /hash-generator` | **body** the text · `algo` `md5`\|`sha1`\|`sha256`\|`sha512`, all four if omitted |
| `GET /jwt-decoder` | **`token`** the JWT, three dot-separated parts |
| `POST /ssh-key-inspect` | **body** a public key or `authorized_keys` line |
| `GET /ssh-keypair-generator` | `type` `ed25519`\|`rsa` · `bits` 2048\|3072\|4096 · `comment` |
| `POST /cert-reader` | **body** a PEM certificate |

### Networking

| Endpoint | Parameters |
|---|---|
| `GET /ip` | none — returns your public address, nothing else |
| `GET /subnet-calculator` | **`cidr`** e.g. `10.0.0.0/22`, v4 or v6 |
| `GET /subnet-splitter` | **`cidr`** · `count` equal subnets, rounded up to a power of two · `prefix` split down to this length · `divide` an explicit division tree · `limit` 1–4096, default 256 · `offset` |
| `GET /dns-lookup` | **`name`** · `type` `A`\|`AAAA`\|`CNAME`\|`MX`\|`TXT`\|`NS`\|`SOA`\|`SRV`\|`CAA`\|`PTR`\|`all` |
| `GET /mail-check` | **`domain`** — a URL or email address is reduced to its domain |
| `GET /ip-range` | **`range`** e.g. `10.0.0.5-10.0.0.30`, or a CIDR to see its range |
| `GET /bandwidth` | **`rate`** · `unit` default `Gbps` · `size` · `sizeUnit` default `GiB` · `overhead` percent |

### Data Format

| Endpoint | Parameters |
|---|---|
| `POST /base64` | **body** · `mode` `auto`\|`encode`\|`decode` · `urlsafe` |
| `GET /bytes-converter` | **`value`** · **`from`** e.g. `GB` or `GiB` · `to` a single unit, or the whole table |
| `POST /yaml-json` | **body** · `to` `json`\|`yaml`\|`auto` · `indent` 0–8 |
| `GET /duration` | **`value`** seconds, or `1h30m`, `2h 30min`, `PT1H30M` |
| `GET /timestamp-converter` | `value` epoch seconds, millis, ISO 8601 or `now` · `tz` IANA zone |
| `POST /json-beautify` | **body** · `indent` 0–8, `0` minifies · `sort` sort keys |

### Text

| Endpoint | Parameters |
|---|---|
| `GET /case-converter` | **`text`** · `to` `camel`\|`pascal`\|`snake`\|`kebab`\|`constant`\|`title`\|`sentence`\|`dot`\|`path`\|`lower`\|`upper` |
| `GET /lorem-ipsum` | `unit` `paragraphs`\|`sentences`\|`words` · `count` · `classic` |
| `POST /text-tool` | **body** · `op` `join`\|`split`\|`trim`\|`dedupe`\|`sort`\|`reverse`\|`count` · `sep` supports `\n` and `\t` · `drop-empty` |

### System

| Endpoint | Parameters |
|---|---|
| `GET /file-permissions` | `mode` octal e.g. `755` or `4755` · `symbolic` e.g. `rwxr-xr-x` — one or the other |
| `POST /systemd-lint` | **body** a unit file |
| `GET /cron-explain` | **`expr`** 5 fields or a macro like `@daily` · `count` 1–50 · `tz` IANA zone |

## Two tools that answer more than you asked

`hash-generator` and `case-converter` follow the same idea: **a bare call is the
overview, an argument narrows it.** With no `?algo=` or `?to=`, you get every
algorithm or every case as labelled fields. With one, you get that single value
as bare text — so it pipes cleanly:

```console
$ printf 'hello world' | curl -s --data-binary @- 'tools.truvibe.dev/hash-generator?algo=sha256'
b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
```

`bytes-converter` does the same in reverse — omit `?to=` and you get the value
in every unit, in both the 1000-based and 1024-based conventions, rather than
having to ask five times.

## Code snippets

Each tool's **API** tab in the browser generates a ready-to-paste snippet in
curl, PowerShell, Python, JavaScript and Go, with a second picker for what the
snippet leaves you holding.

For curl those are the wire formats. For everything else they are native shapes:

| | |
|---|---|
| PowerShell | text, array, hashtable, `PSCustomObject` |
| Python | text, list, tuple, set, dict, items |
| JavaScript | text, array, `Set`, object, `Map`, entries |
| Go | text, `[]string`, `map[string]string` |

Which shapes appear depends on what the tool returns — a list of UUIDs has no
sensible hashtable form — so `outputsFor()` in `lib/tools/snippets.ts` filters by
result kind.
