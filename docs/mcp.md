# MCP server

Every tool is also an [MCP](https://modelcontextprotocol.io) tool, so an agent
can call `lookup_dns` directly instead of guessing a curl URL.

```
https://tools.truvibe.dev/mcp
```

Streamable HTTP, stateless, no key. Point a client at it:

```console
$ claude mcp add --transport http trutools https://tools.truvibe.dev/mcp
```

Or, for clients configured with JSON:

```json
{
  "mcpServers": {
    "trutools": { "type": "http", "url": "https://tools.truvibe.dev/mcp" }
  }
}
```

The **MCP** button in the site's navbar has copy-paste setup for Claude,
ChatGPT, Claude Code, Codex, Gemini CLI, Cursor and VS Code.

## Tools

One MCP tool per API endpoint, named `<verb>_<tool>` with dashes turned into
underscores:

| HTTP | MCP |
|---|---|
| `/lookup/dns` | `lookup_dns` |
| `/generate/ssh-key` | `generate_ssh_key` |
| `/calc/subnet-split` | `calc_subnet_split` |

The arguments are the endpoint's query parameters, with the same names,
defaults and validation. Tools that take a request body over HTTP take it as a
`body` argument here. Values may be strings, numbers or booleans. They are
stringified and parsed exactly as `?length=32` would be, so an error reads the
same as the one curl gets.

`/lookup/ip` is left out. Over MCP, the caller is the client's host, not the
person asking.

## Results

Each call returns two things:

- **`content`**: the plain-text rendering, byte-for-byte what `curl` prints.
- **`structuredContent`**: the `?format=json` body, `{ tool, result, note? }`.

Bad input comes back as `isError: true` with the same message a 400 would carry.

## Limits

Each POST to `/mcp` counts once against the same per-IP
[rate limit](api.md) as the HTTP API. A `tools/call` is one request, and so is
the `initialize` before it.

## Trying it

```console
$ npx @modelcontextprotocol/inspector
```

Choose *Streamable HTTP* and enter the URL above. Or use plain curl:

```console
$ curl -s https://tools.truvibe.dev/mcp \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
         "params":{"name":"lookup_dns","arguments":{"name":"example.com","type":"MX"}}}'
```

## How it is built

This is a third front door onto the same functions. See
[architecture](architecture.md#the-mcp-server).
