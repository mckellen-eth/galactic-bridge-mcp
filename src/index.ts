#!/usr/bin/env node
// Galactic Bridge MCP server.
//
// Exposes the Galactic Bridge route-finder to AI agents and MCP clients
// (Claude Desktop, Cursor, …). By default it is READ-ONLY: it finds routes and
// builds ready-to-sign transactions, but never holds keys or signs anything —
// the human/wallet does that. Auto-signing is an opt-in add-on (see README).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { NETWORKS, NETWORK_KEYS } from './networks.js';
import { scanToken } from './api.js';
import { buildBridgeRoute } from './build.js';
import { isSigningEnabled, signAndSend } from './signer.js';

const server = new McpServer({ name: 'galactic-bridge', version: '0.1.0' });

const text = (obj: unknown) => ({
  content: [{ type: 'text' as const, text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }],
});
const fail = (msg: string) => ({ content: [{ type: 'text' as const, text: msg }], isError: true });

// ---- 1. list_supported_networks ---------------------------------------------
server.tool(
  'list_supported_networks',
  'List the EVM networks Galactic Bridge supports, with their chain key, chainId, LayerZero endpoint id (eid) and native gas symbol. Use the `key` values when calling the other tools.',
  {},
  async () => text(
    Object.values(NETWORKS).map((n) => ({
      key: n.key, name: n.name, chainId: n.chainId, eid: n.eid, nativeSymbol: n.nativeSym,
    }))
  )
);

// ---- 2. scan_token_networks -------------------------------------------------
server.tool(
  'scan_token_networks',
  'Given a token contract address, find every supported network the token exists on and its OFT bridge contract on each. Useful to discover where a token can be bridged from and to before resolving a specific route.',
  {
    token: z.string().describe('The token contract address (0x…). Works on any of the supported networks.'),
    fromChain: z.string().optional().describe('Optional network key to start the scan from (e.g. "bsc"). Auto-detected if omitted.'),
  },
  async ({ token, fromChain }) => {
    try {
      const r = await scanToken(token, fromChain);
      if (r.ok !== true) return text({ ok: false, message: r.error || 'Token not found on any supported network.' });
      const networks = Object.entries(r.chains || {}).map(([key, v]: [string, any]) => ({
        network: key,
        tokenAddress: v.tokenAddress,
        oftContract: v.oftContract,
        tokenIsOft: v.tokenIsOft,
      }));
      return text({
        ok: true,
        token: r.token,
        meta: r.meta || null,
        detectedChain: r.detectedChain,
        networks,
      });
    } catch (e: any) {
      return fail(`scan_token_networks failed: ${e.message}`);
    }
  }
);

// ---- 3. find_bridge_route (safe: build only, no signing) --------------------
server.tool(
  'find_bridge_route',
  'Resolve the bridge route for a token between two networks: the OFT contract, whether the direction is enabled right now, the fee, and — if amount and recipient are given — a ready-to-sign transaction (plus an ERC-20 approval transaction when the token bridges through a separate adapter). This tool NEVER signs or sends; it returns transactions for a human or wallet to review and sign.',
  {
    token: z.string().describe('Token contract address (0x…).'),
    fromChain: z.string().describe('Source network key (e.g. "bsc"). See list_supported_networks.'),
    toChain: z.string().describe('Destination network key (e.g. "arc").'),
    amount: z.string().optional().describe('Human-readable amount to bridge, e.g. "12.5". Required to build a transaction.'),
    recipient: z.string().optional().describe('Recipient address on the destination network (also the refund address). Required to build a transaction.'),
    decimals: z.number().int().optional().describe('Token decimals. Read automatically if omitted; pass explicitly to be certain.'),
    oftContract: z.string().optional().describe('Optional: the OFT contract address, if you already know it (skips discovery).'),
  },
  async (args) => {
    try {
      const r = await buildBridgeRoute(args);
      return text(r);
    } catch (e: any) {
      return fail(`find_bridge_route failed: ${e.message}`);
    }
  }
);

// ---- 4. execute_bridge (OPT-IN: only when GB_PRIVATE_KEY is set) -------------
if (isSigningEnabled()) {
  server.tool(
    'execute_bridge',
    'ADVANCED / OPT-IN. Build, sign and broadcast the bridge transaction using the private key configured in GB_PRIVATE_KEY. If the token bridges through an adapter, the ERC-20 approval is signed and confirmed first. This moves real funds irreversibly — only enabled because a signing key is configured in this environment.',
    {
      token: z.string().describe('Token contract address (0x…).'),
      fromChain: z.string().describe('Source network key.'),
      toChain: z.string().describe('Destination network key.'),
      amount: z.string().describe('Human-readable amount to bridge, e.g. "12.5".'),
      recipient: z.string().describe('Recipient address on the destination network.'),
      decimals: z.number().int().optional().describe('Token decimals (read automatically if omitted).'),
      oftContract: z.string().optional().describe('Optional known OFT contract address.'),
    },
    async (args) => {
      try {
        const built = await buildBridgeRoute(args);
        if (!built.ok || !built.bridgeTransaction) {
          return text({ ok: false, message: built.message });
        }
        const sent: Record<string, string> = {};
        if (built.approvalTransaction) {
          sent.approvalTxHash = await signAndSend(args.fromChain, built.approvalTransaction);
        }
        sent.bridgeTxHash = await signAndSend(args.fromChain, built.bridgeTransaction);
        const net = NETWORKS[args.fromChain];
        return text({
          ok: true,
          message: `Bridge transaction broadcast on ${net?.name || args.fromChain}.`,
          ...sent,
          explorer: net ? `${net.explorerUrl}/tx/${sent.bridgeTxHash}` : undefined,
        });
      } catch (e: any) {
        return fail(`execute_bridge failed: ${e.message}`);
      }
    }
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error(
    `[galactic-bridge-mcp] ready — ${NETWORK_KEYS.length} networks, ` +
    `signing ${isSigningEnabled() ? 'ENABLED (execute_bridge available)' : 'disabled (read-only)'}`
  );
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[galactic-bridge-mcp] fatal:', e);
  process.exit(1);
});
