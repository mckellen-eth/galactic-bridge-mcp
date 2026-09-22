// Thin HTTP client for the Galactic Bridge public API.
// This is the ONLY thing the MCP server talks to over the network for reads —
// the same endpoints the website itself calls. No keys, no auth, read-only.

const BASE_URL = (process.env.GB_API_URL || 'https://galacticbridge.app').replace(/\/+$/, '');

async function getJson(path: string, params: Record<string, string | undefined>): Promise<any> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  }
  const url = `${BASE_URL}${path}?${qs.toString()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Galactic Bridge API returned a non-JSON response (HTTP ${res.status}). It may be temporarily unavailable.`);
  }
  return body;
}

/** All networks a token exists on, plus its OFT contract per network. */
export function scanToken(token: string, fromChain?: string, refresh?: boolean) {
  return getJson('/api/scan-token', {
    token,
    fromChain,
    refresh: refresh ? '1' : undefined,
  });
}

/**
 * Resolve the exact bridge route for a pair: the OFT contract, whether the
 * direction is enabled right now, the fee quote, and the send() call layout.
 */
export function findParams(args: {
  token: string;
  fromChain: string;
  toChain: string;
  wallet?: string;
  oftContract?: string;
  dstOft?: string;
}) {
  return getJson('/api/find-params', {
    token: args.token,
    fromChain: args.fromChain,
    toChain: args.toChain,
    wallet: args.wallet,
    oftContract: args.oftContract,
    dstOft: args.dstOft,
  });
}

/** Read-only eth_call proxied through the bridge (used to fetch token decimals). */
export async function rpcCall(chain: string, to: string, data: string): Promise<string | null> {
  const body = await getJson('/api/rpc-call', { chain, to, data });
  return body?.ok ? body.result : null;
}

export { BASE_URL };
