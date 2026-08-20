# Contributing

Thanks for looking. This is a small hobby project, so the bar is "does it fit"
rather than "is it perfect".

Issues, pull requests and discussion are all welcome. For anything larger than a
fix, open an issue first — it is a much cheaper way to find out that an idea
does not fit than writing it and finding out afterwards.

## Getting it running

Node 24+ and pnpm 10+.

```bash
pnpm install
docker compose up -d          # Redis on :6380 for the rate limiter
cp .env.example .env.local
pnpm dev
```

`pnpm dev` binds `0.0.0.0`, so the dev server is reachable from other machines
on your network — handy for testing on a phone, worth knowing before you run it
on a café's wifi.

If you reach it as anything other than `localhost`, Next will block the
cross-origin requests to its dev assets until you name that hostname:

```bash
# in .env.local, which is gitignored
ALLOWED_DEV_ORIGINS=dev.example.com,*.example.com
```

That is read by `next.config.ts` rather than hardcoded there, so nobody's dev
host ends up published in the repo. It has no effect on a production build.

Redis is optional. Without `REDIS_URL` the limiter falls back to an in-process
one and logs a warning; that is fine unless you are specifically working on rate
limiting.

Before opening anything:

```bash
pnpm lint
pnpm build
```

Both must pass. There is no test runner — see [Testing](#testing).

## Adding a tool

Four files, in this order. The registry is the spine; everything else hangs off
it.

### 1. The logic — `lib/tools/impl/<tool>.ts`

One exported function. Return a [`ToolResult`](lib/tools/result.ts), throw
`ToolInputError` for anything the caller got wrong.

```ts
import { ToolInputError, type ToolResult } from "../result";

export function describeThing(input: string): ToolResult {
  if (!input.trim()) throw new ToolInputError("input is required");

  return {
    kind: "fields",
    fields: [
      { label: "Something", value: "…" },
      { label: "Something else", value: "…" },
    ],
  };
}
```

**Keep it isomorphic.** No `node:` imports, no `window`. The same function runs
in the browser panel and in the route handler, and that is the entire point —
it is why the two front doors cannot disagree. If a tool genuinely needs Node
(X.509 parsing) or the network (a resolver), put it in `lib/tools/impl/server/`
and mark the tool `serverOnly` in the registry; its panel will call the API
instead of computing locally.

Pick the result kind that matches the shape of the answer:

| Kind | For | Example |
|---|---|---|
| `text` | one blob | Beautify JSON, Lorem Ipsum |
| `lines` | a list of equals | generated passwords, UUIDs |
| `fields` | labelled readings | subnet calculator, cron explainer |
| `rows` | a table | DNS records, subnet splitter, bytes table |

The kind also drives which code-snippet output shapes the API tab offers, so a
wrong one shows people a Python `dict` for something that is really a list.

### 2. The registry entry — `lib/tools/registry.ts`

This one entry gives you a card, search coverage, an entry in the `/api/v1`
index and a generated snippet in five languages. Fill in `keywords` generously —
it is what makes the search box find a tool by the name someone actually calls
it. `api.query` is used to build every example snippet, so make it a sensible
demo rather than a minimal one.

**Keep this file free of React and lucide imports.** Route handlers import it,
and dragging icon components into a server bundle buys nothing. Icons are string
keys, resolved in `components/tools/icon-map.tsx` — add yours there.

One trap: tool ids are **root-level URLs**. Next resolves static segments before
dynamic ones, so a future page at `/search` would silently shadow a tool with
that id. Pick ids that are unlikely to collide with a page.

### 3. The API handler — `lib/api/handlers.ts`

Parse query params, call your function. Use the existing `intParam`,
`boolParam`, `enumParam` and `requireBody` helpers rather than hand-rolling
validation — they throw `BadRequestError`, which the route maps to a 400 in
whatever format the caller asked for.

### 4. The panel — `components/tools/panels/`

Grouped by section, not one file per tool. Register it in `panels/index.tsx`.

Panels drive themselves: the output updates as the input changes, rather than
waiting for a "Go" button. `useToolRun` handles that, with `run` for synchronous
tools and `runAsync` for anything returning a promise.

### Then check both doors agree

```bash
curl 'localhost:3000/your-tool?foo=bar'
curl 'localhost:3000/your-tool?foo=bar&format=json'
curl -w '[%{http_code}]' 'localhost:3000/your-tool'   # the error path
```

and open the card in the browser. Same numbers, or something is wrong.

## Testing

There is no test framework, deliberately — for tools this size, a suite that
only checks the code against itself proves very little.

What is expected instead: **check a tool against the thing it is imitating.**

```bash
printf 'hello world' | sha256sum          # vs /hash-generator?algo=sha256
chmod 4755 f && stat -c '%a %A' f         # vs /file-permissions?mode=4755
python3 -c 'import ipaddress; ...'        # vs /subnet-inspector
```

Most of these tools exist because a well-known utility already defines the right
answer. `md5sum`, `stat`, `dig`, `python3 -m ipaddress` and `date` are the
specification. Say in the PR what you checked against.

For anything with interesting edges, a throwaway `pnpm dlx tsx` script that
round-trips random inputs is worth more than a handful of hand-picked
assertions.

## House style

The code is commented more than most, and the comments are nearly all
**"why", not "what"**. A comment explaining that `count++` increments a counter
will get removed; one explaining why the rate limiter fails open, or why a
multi-line field is flush-left rather than indented, is the reason the file is
readable a year later. Match that.

Some specifics:

- **British spelling in prose**, US spelling in code identifiers where a library
  or the platform already made the choice (`color`, `serialize`).
- Errors people read should say what to do, not just what went wrong.
  `"count must be between 1 and 50"` beats `"invalid count"`.
- No new dependency without a reason that survives being said out loud. `yaml`
  is here because writing a YAML parser is not a sensible use of anyone's time;
  MD5 is hand-written because it is 60 lines and Web Crypto deliberately omits
  it.
- Plain-text output is the primary format. If it doesn't read well in a
  terminal, it isn't finished.

## Commits

Present tense, imperative, explaining the change rather than the diff:

```
Add the cron explainer
Fix the IP reported behind an L4 passthrough
Remove the umask calculator
```

Keep unrelated changes in separate commits.

## What is likely to be turned down

- Anything needing an account, a key or a database
- A tool that is mostly a wrapper around a third-party paid API
- Tracking, analytics or ads, in any form
- Anything that can't work over plain text in a terminal — the API is not an
  afterthought, it is half the product

Deliberately still open, if you fancy it: a table converter
(CSV/JSON/Markdown/HTML), DKIM support in Mail Check, an HTTP header inspector
and a TLS certificate checker that fetches a live host.
