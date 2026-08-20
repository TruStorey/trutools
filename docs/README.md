# trutools docs

| | |
|---|---|
| [tools.md](tools.md) | What each of the 28 tools does, and the edges worth knowing |
| [api.md](api.md) | The API — formats, errors, rate limits, every endpoint |
| [architecture.md](architecture.md) | How the codebase fits together, and why |
| [self-hosting.md](self-hosting.md) | Running your own copy |

Also at the top level: [CONTRIBUTING.md](../CONTRIBUTING.md) for adding a tool
and the house style, and [SECURITY.md](../SECURITY.md) for reporting a
vulnerability and what the service does with your input.

The API also documents itself, and that listing is generated from the same
registry the site is built from — so if it ever disagrees with this directory,
believe it:

```console
$ curl tools.truvibe.dev/api/v1
```
