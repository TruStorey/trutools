# The tools

Twenty-seven of them, in five sections. This page is about **what each one does
and where the interesting edges are** — the parameter lists live in
[`api.md`](api.md), and `curl tools.truvibe.dev/api/v1` prints them too.

Unless a tool is marked **server**, it runs entirely in your browser and nothing
is sent anywhere.

---

## Crypto

### Password Generator

Length, count, and which character classes are in play. Shows the **entropy in
bits** as you change the options, which is the number that actually matters and
the one every "must contain a symbol" policy ignores.

`exclude-ambiguous` drops `O`, `0`, `l` and `1` — worth it for anything a human
will read off a screen and type somewhere else, and a waste of entropy
otherwise.

### UUID Generator

Version 4 for pure randomness, **version 7 when you want them to sort by time**.
v7 puts a millisecond timestamp in the high bits, so they order naturally as
database keys — which is the reason to prefer them over v4 for anything that
becomes a primary key. Both are from RFC 9562.

### Token Generator

Cryptographically random tokens with an optional prefix. The prefix is not
decoration: `sk_live_…` is the convention Stripe and GitHub use so that **secret
scanners can recognise a leaked key** in a public repo and revoke it. If you are
minting API keys, give them a distinctive prefix.

### Hash Generator

MD5, SHA-1, SHA-256 and SHA-512, all four at once or one at a time with
`?algo=`.

**MD5 is hand-written here** — about 60 lines — because Web Crypto deliberately
omits it, and rightly so. It is offered because real systems still emit MD5
checksums and sometimes you have to match one. Use it to check a download, never
to compare a secret.

### JWT Decoder

Header, payload, and expiry status of a JSON Web Token.

**Nothing is verified.** Without the signing key it cannot be, and a decoder
that stayed quiet about that would invite someone to trust a forged token. The
output carries a "signature not verified" field — in the result itself, not just
in the documentation. If you need to *validate* a token, you need the key, and
that is a different job.

### SSH Key Inspector

Paste a public key or an `authorized_keys` line and get the type, size, both
fingerprints (SHA-256 and the legacy MD5 form), the comment, and any forced
options like `command=` or `no-port-forwarding`.

Useful for answering "which of these keys is on that server", since the SHA-256
fingerprint is what `ssh-keygen -lf` and most control panels show.

**It refuses private keys** rather than parsing them. Never paste a private key
into a website — this one won't take it, but the habit is what matters.

### SSH Keypair Generator

ed25519 or RSA, in OpenSSH format, ready for `authorized_keys`.

**In the browser, this runs on WebCrypto and the private key never leaves the
page.** The `/ssh-keypair-generator` API endpoint exists so `curl` users are not
excluded, but using it means sending a private key over the network — fine for a
throwaway, wrong for a key that will guard anything. Prefer the browser tool, or
`ssh-keygen`.

Prefer ed25519 unless something in the chain is too old to accept it: shorter,
faster, and no key-size decision to get wrong.

### Certificate Reader · server

Paste a PEM certificate, read back subject, issuer, SANs, validity window and
fingerprints.

X.509 parsing needs `node:crypto`, so this one genuinely cannot run in the page.
It reads a certificate you already have; it does not fetch one from a live host.

---

## Networking

### Subnet Inspector

CIDR in, every number you actually need out: network, netmask, wildcard,
broadcast, usable range, host count, and whether the block is private,
loopback, link-local or public. IPv4 and IPv6.

Handles the two prefixes people get wrong. A **`/31`** has no network or
broadcast address — both of its addresses are usable, which is what makes it the
right choice for a point-to-point link (RFC 3021). A **`/32`** is a single host.
IPv6 output is canonicalised per RFC 5952, so it matches what your router will
print rather than an equivalent-but-differently-written form.

### Subnet Splitter

Carve a block into smaller ones, the way
[Dave's visual subnet calculator](https://www.davidc.net/sites/default/subnets/subnets.html)
does: click a row to divide it, click again to join it back. Or skip the
clicking and ask for a set number of equal subnets with `?count=`, or a target
prefix with `?prefix=`.

The division state is a **pre-order binary tree encoded as a bitstring**, which
is what makes a layout shareable as a URL. Uniform splits are described rather
than built — asking for a `/16` split to `/30` is sixteen thousand subnets, and
materialising the tree for that would be silly — so the response paginates with
`?limit=` and `?offset=`.

### Subnet Planner

Carving a block up by hand is usually not a question of halves — it is "a `/24`
for management, something big enough for four thousand pods, a small DMZ". Say
that directly and get the allocation back:

```console
$ curl 'tools.truvibe.dev/subnet-planner?cidr=10.0.0.0/16&need=pods:4000,mgmt:200,dmz:/26'
Name  Subnet        Netmask          Usable range             Hosts  Needed
pods  10.0.0.0/20   255.255.240.0    10.0.0.1 - 10.0.15.254   4,094  4000
mgmt  10.0.16.0/24  255.255.255.0    10.0.16.1 - 10.0.16.254  254    200
dmz   10.0.17.0/26  255.255.255.192  10.0.17.1 - 10.0.17.62   62     /26
```

Each entry in `?need=` is `name:size`. The name is optional and defaults to the
entry's position; the size is either a **host count** or an explicit
**`/prefix`**. `Needed` echoes what you asked for beside what you got, so the
rounding up to the next power of two is visible rather than silent.

Allocation is **first-fit decreasing** — biggest block first — which for
power-of-two blocks packs perfectly, so the only free space is what is left at
the end. That leftover is reported as CIDRs via the same greedy alignment walk
that backs Python's `ipaddress.summarize_address_range`, which remains the
reference worth checking against.

One deliberate deviation from the arithmetic: **host counts never size down to a
`/31`**. RFC 3021 makes both addresses of a `/31` usable and the Subnet
Inspector says so, but handing someone a `/31` because they typed `2` is a
surprise anywhere other than a point-to-point link, so the host-count path stops
at `/30`. Ask for `/31` explicitly and you still get one.

### DNS Lookup · server

A, AAAA, CNAME, MX, TXT, NS, SOA, SRV, CAA, PTR, or `?type=all` for the common
set in one shot, with TTLs and DNSSEC status.

Queries go over **DNS-over-HTTPS to Cloudflare's `1.1.1.1`**, which means two
things. It is not your resolver, so it will not show you split-horizon or
internal records. And **Cloudflare sees the domain you asked about** — inherent
to using someone else's resolver, but worth knowing before you look up an
internal hostname.

`?type=all` runs the queries in parallel, so it costs about the same as one.

### Mail Check · server

SPF and DMARC for a domain, and specifically **whether the SPF record is over
budget**.

That budget is the thing this tool is for. RFC 7208 caps an SPF evaluation at
**ten DNS lookups**, and `include:`, `a`, `mx`, `ptr`, `exists` and `redirect`
each spend from it — recursively, through every nested `include:`. Go over and a
conforming receiver returns `permerror`, which in practice means your mail gets
treated as unauthenticated. Nothing warns you: the record still resolves, DNS is
perfectly happy, and **the limit is enforced by the receiving mail server, at
delivery time**. Adding one more SaaS sender to a record that is already at nine
is how a domain quietly stops being trusted.

The tool walks the includes, counts the lookups the way a receiver would, and
tells you where you are against the ten. A surprising number of large,
well-run domains sit at exactly 10 of 10 — no headroom for the next vendor.

DKIM is not checked. It needs a selector, which is not discoverable from the
domain alone.

### Bandwidth & Transfer Time

Mbps to MB/s and back, plus how long a given transfer actually takes.

Two traps, both handled. **Network rates are decimal and storage is binary** —
1 Gbps is 1,000,000,000 bits per second, but 1 GiB is 1,073,741,824 bytes, and
the eight-versus-ten confusion between them is why "gigabit" links feel slow.
And **protocol overhead is real**: about 6% for TCP over Ethernet once you have
paid for headers, so the `overhead` parameter puts the honest number next to the
theoretical one.

### What Is My IP · server

The public address your request arrived from. Plain text, nothing else, so it
pipes straight into a script — the [icanhazip](https://icanhazip.com) model.

```console
$ curl tools.truvibe.dev/ip
203.0.113.42
```

Getting this right is harder than it looks. icanhazip reports the socket peer
and ignores forwarding headers entirely; a Next route handler cannot see the
socket, so this reconstructs the same answer by scanning `X-Forwarded-For`
**from the right for the first publicly routable address**. That skips our own
proxy and container hops, all private, and cannot be moved by a spoofed header,
because a caller can only prepend entries on the left.

`GET /ip?debug` dumps every forwarding header that arrived and marks each chain
entry public or private, which is how you work out why an answer is wrong. It is
on outside production and behind `IP_DEBUG=1` in it.

---

## Data Format

### Base64 Encode / Decode

Both directions, with `?urlsafe` for the URL-safe alphabet without padding.

`mode=auto` is a **heuristic**: input that is valid base64 *and* decodes to
printable text is treated as encoded. That guesses wrong occasionally — `deadbeef`
is legitimately both — so the result always says which way it went, and
`mode=encode` or `mode=decode` forces it.

### Bytes Converter

A value in one unit, shown in every other, in **both conventions at once**: kB,
MB, GB (1000-based) alongside KiB, MiB, GiB (1024-based). One call rather than
five, because the whole reason you are here is that something reported 1.5 GB
and something else reported 1.4 GiB and you want to know whether they agree.
They do.

### YAML / JSON Converter

Either direction, auto-detecting which one you gave it. If it will not parse you
get **the error and the line it is on**, which is the actual reason to reach for
this rather than a REPL — YAML failures are usually indentation you cannot see.

Backed by the `yaml` package, the one new runtime dependency in the project.

### Duration Converter

`5400`, `1h30m`, `2h 30min`, `PT1H30M` and `01:30:00` are all the same ninety
minutes, and each is what some particular config file insists on. Give it any
one, get all of them — plus seconds, minutes, hours and days as plain numbers.

The `systemd` row is the form `systemd.time(7)` accepts, which is not quite the
same grammar as the compact one Go and Prometheus use.

### Timestamp Converter

Unix epoch, ISO 8601 and human-readable, in any direction, with an IANA timezone
for the readable line. Accepts seconds or milliseconds and works out which you
meant. `value=now` for the current instant.

### Beautify JSON

Reformat minified JSON into something readable, or minify it back with
`indent=0`. `sort=true` sorts object keys, which turns "did this config change"
into a diff you can actually read.

Invalid JSON gets the parse error and its position rather than a bare failure.

---

## Text

### Case Converter

camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, Title Case,
sentence case, dot.case, path/case, lower and upper. All at once, or one with
`?to=`.

One inherent ambiguity worth knowing: **splitting a string into words is a
guess**. `a.b.c` could reasonably be three words or one dotted token, and
`XMLHttpRequest` splits differently depending on whether you treat runs of
capitals as a single word. Round-tripping through two cases is therefore not
always lossless. The tool is consistent with itself; it is not a parser.

### Lorem Ipsum

Placeholder text by paragraph, sentence or word. `classic=true` starts with the
traditional "Lorem ipsum dolor sit amet".

### Text Tool

The everyday list-wrangling that otherwise costs a `sort | uniq` and a moment's
thought: join lines into one, split one into many, trim whitespace, drop
duplicates, sort, reverse, or just count what is there.

`sep` understands `\n` and `\t`, so joining a list of hostnames into a
comma-separated string, or splitting a CSV row into lines, is one call.

---

## System

### File Permissions

`755` to `rwxr-xr-x` and back, with the owner/group/other breakdown and the
`chmod` command to apply it.

The **special bits** are where a permissions calculator usually goes wrong, so
they are the part that was checked hardest against real `stat` output: `4755` is
`rwsr-xr-x` (setuid), `2755` is `rwxr-sr-x` (setgid), `1777` is `rwxrwxrwt`
(sticky, as on `/tmp`). And when the execute bit underneath is *clear*, the
letter is a **capital** `S` or `T` — which is `ls` telling you the special bit is
set but useless.

### Systemd Unit Linter

Structural checks on a unit file: unknown sections, directives sitting outside
any section, a `[Service]` with no `ExecStart`, misplaced keys.

**It is not `systemd-analyze verify`.** It cannot be — the runtime image is
`node:24-alpine`, which has no systemd in it at any point. This is parsing, and
it says so in its own output rather than implying it ran the real validator. It
catches the typo class of mistake, not "will this actually start".

### Cron Explainer

What a cron expression means in English, and when it next runs, in your
timezone.

The reason this tool exists is one rule: **when both day-of-month and day-of-week
are restricted, cron ORs them.** `0 0 13 * 5` is not "Friday the 13th" — it is
"every 13th of the month, *and* every Friday", which is roughly five times more
often than the person writing it expected. If either field is `*`, they AND
normally. The tool flags this case explicitly, because it is the single most
common way a schedule silently misfires.

Macros (`@daily`, `@weekly`, `@reboot`) are understood. The five-field Unix form
is what is parsed — not the six- or seven-field Quartz variant, which adds
seconds and years.
