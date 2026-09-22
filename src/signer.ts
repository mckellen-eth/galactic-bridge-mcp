// OPTIONAL signer seam — OFF by default.
//
// The safe core (list / scan / find_bridge_route) never imports or uses this.
// Auto-signing only comes to life when the user sets GB_PRIVATE_KEY in their own
// environment, on their own machine. Without it, `isSigningEnabled()` is false,
// the `execute_bridge` tool is never registered, and no key is ever read.
//
// This is the "empty socket" from the plan: the full flow is written, but it
// stays inert until the user consciously opts in. See README → "Optional: auto-signing".

import type { EvmTransaction } from './build.js';
import { getNetwork } from './networks.js';

export function isSigningEnabled(): boolean {
  return !!process.env.GB_PRIVATE_KEY;
}

function rpcFor(chainKey: string): string {
  const override = process.env[`GB_RPC_${chainKey.toUpperCase()}`];
  if (override) return override;
  const net = getNetwork(chainKey);
  if (!net || !net.defaultRpc) {
    throw new Error(`No RPC URL configured for "${chainKey}". Set GB_RPC_${chainKey.toUpperCase()} in your environment.`);
  }
  return net.defaultRpc;
}

/**
 * Sign and broadcast a prebuilt transaction. Throws with a clear message if
 * ethers isn't installed or no key is set. Never called unless signing is enabled.
 */
export async function signAndSend(chainKey: string, tx: EvmTransaction): Promise<string> {
  const pk = process.env.GB_PRIVATE_KEY;
  if (!pk) throw new Error('Signing is not enabled (GB_PRIVATE_KEY is not set).');

  let ethers: any;
  try {
    ethers = await import('ethers');
  } catch {
    throw new Error('Auto-signing needs the optional "ethers" package. Install it: npm install ethers');
  }

  const provider = new ethers.JsonRpcProvider(rpcFor(chainKey));
  const wallet = new ethers.Wallet(pk, provider);

  const sent = await wallet.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: BigInt(tx.value),
  });
  await sent.wait();
  return sent.hash;
}
