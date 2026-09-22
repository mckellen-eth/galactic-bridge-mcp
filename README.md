# Galactic Bridge MCP

An [MCP](https://modelcontextprotocol.io) server that lets AI agents and MCP
clients (Claude Desktop, Cursor, …) use [Galactic Bridge](https://galacticbridge.app)
to find LayerZero **OFT** bridge routes by token contract address and build
ready-to-sign cross-chain transactions across **14 EVM networks** — including
tokens that aren't listed on aggregators like Stargate.

By default this server is **read-only**. It finds routes and builds transactions,
but it never holds a key and never signs anything — a human or wallet does that.
Auto-signing is an optional add-on you turn on yourself (see the bottom).

## What it does

It talks only to the public Galactic Bridge API — the same endpoints the website
calls. It does not run on the bridge's servers and changes nothing there.

### Tools

| Tool | What it does |
| --- | --- |
| `list_supported_networks` | The 14 networks, with chain key, chainId, LayerZero eid and native symbol. |
| `scan_token_networks` | Given a token address, every network it exists on and its OFT contract on each. |
| `find_bridge_route` | Resolves a route between two networks: OFT contract, whether the direction is enabled right now, the fee, and — with `amount` + `recipient` — a ready-to-sign transaction (plus an ERC-20 approval when the token bridges through a separate adapter). |

`find_bridge_route` never signs or sends. It returns transaction objects
(`{ to, data, value, chainId }`) for you to review and sign in your own wallet.

## Install

Requires Node.js 18+.

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "galactic-bridge": {
      "command": "npx",
      "args": ["-y", "galactic-bridge-mcp"]
    }
  }
}
```

### Cursor / other MCP clients

Point the client at the command `npx -y galactic-bridge-mcp` (stdio transport).

### From source

```bash
git clone https://github.com/mckellen-eth/galactic-bridge-mcp.git
cd galactic-bridge-mcp
npm install
npm run build
node dist/index.js
```

## Example

> "Bridge 50 of token 0x90e7…d9e1 from BNB Chain to Arc, to my address 0xABC…"

The agent calls `find_bridge_route` and gets back a ready transaction plus the
fee. You review it and sign in your wallet. If the token uses a separate adapter,
you'll also get an approval transaction to sign first.

## Safety

- **No keys by default.** The read-only tools never see a private key.
- **You sign.** Transactions are returned for review; your wallet signs them.
- **Fees and decimals are read live**, so amounts are exact. Directions that a
  token has disabled are reported instead of returning a transaction that would
  revert.

Always verify a transaction before signing. This software is provided as-is,
with no warranty (MIT).

---

## Optional: auto-signing (advanced)

You can let the server sign and broadcast transactions itself by setting a
private key in your environment. **This moves real funds irreversibly and is off
by default.** Only enable it if you understand the risk, and use a dedicated hot
wallet that holds no more than you can afford to lose.

```json
{
  "mcpServers": {
    "galactic-bridge": {
      "command": "npx",
      "args": ["-y", "galactic-bridge-mcp"],
      "env": {
        "GB_PRIVATE_KEY": "0xyourHotWalletKey"
      }
    }
  }
}
```

When `GB_PRIVATE_KEY` is set, an extra tool appears — `execute_bridge` — which
builds, signs and broadcasts the bridge transaction (and the approval first, if
needed). It needs the optional `ethers` package (`npm install ethers`) and, for
networks without a built-in public RPC, an override like `GB_RPC_BSC=…`.

Without `GB_PRIVATE_KEY`, none of this loads and the server stays read-only.

## Configuration

| Variable | Purpose |
| --- | --- |
| `GB_API_URL` | Override the bridge API base URL (default `https://galacticbridge.app`). |
| `GB_PRIVATE_KEY` | Opt in to auto-signing. Unset = read-only. |
| `GB_RPC_<CHAIN>` | RPC URL used by auto-signing for that chain (e.g. `GB_RPC_ARC`). |
