// Resolve a bridge route and build the ready-to-sign transaction(s).
// This is the heart of the "safe" mode: it does everything up to — but not
// including — signing. The returned transactions are handed back to the caller
// (a human, or a wallet the user controls) to review and sign.

import { findParams, rpcCall } from './api.js';
import { getNetwork } from './networks.js';
import { encodeSendCalldata, encodeApprove, parseUnits, decodeUint, DECIMALS_SELECTOR } from './encode.js';

export interface EvmTransaction {
  to: string;
  data: string;
  value: string;      // decimal string, wei
  chainId: number;
  description: string;
}

export interface BuildResult {
  ok: boolean;
  /** Human-readable explanation — always present, especially when ok is false. */
  message: string;
  route?: {
    fromChain: string;
    toChain: string;
    token: string;
    oftContract: string;
    tokenIsOft: boolean;
    nativeFee: string;
    nativeSymbol: string;
    dstEid: number;
  };
  /** Only when a separate adapter needs ERC-20 approval first. Sign this before the bridge tx. */
  approvalTransaction?: EvmTransaction;
  /** The bridge send() transaction, ready to sign. Only present when an amount + recipient were given. */
  bridgeTransaction?: EvmTransaction;
  notes?: string[];
}

const ZERO = '0x0000000000000000000000000000000000000000';

export async function buildBridgeRoute(args: {
  token: string;
  fromChain: string;
  toChain: string;
  amount?: string;
  recipient?: string;
  decimals?: number;
  oftContract?: string;
}): Promise<BuildResult> {
  const from = getNetwork(args.fromChain);
  const to = getNetwork(args.toChain);
  if (!from) return { ok: false, message: `Unknown source network "${args.fromChain}". Use list_supported_networks to see valid keys.` };
  if (!to)   return { ok: false, message: `Unknown destination network "${args.toChain}". Use list_supported_networks to see valid keys.` };
  if (from.key === to.key) return { ok: false, message: 'Source and destination networks are the same.' };

  const wallet = args.recipient || '0x000000000000000000000000000000000000dEaD';
  const r = await findParams({
    token: args.token,
    fromChain: from.key,
    toChain: to.key,
    wallet,
    oftContract: args.oftContract,
  });

  // The API explains, in plain terms, why a route can't be built. Pass that through.
  if (!r || r.ok !== true) {
    const msg = r?.error || 'No bridge route could be resolved for this pair.';
    return { ok: false, message: msg };
  }

  const route = {
    fromChain: from.key,
    toChain: to.key,
    token: args.token.toLowerCase(),
    oftContract: r.oftContract,
    tokenIsOft: !!r.tokenIsOft,
    nativeFee: String(r.nativeFee),
    nativeSymbol: from.nativeSym,
    dstEid: Number(r.dstEid),
  };

  const notes: string[] = [];
  notes.push(
    `The bridge fee is ${route.nativeFee} wei of ${from.nativeSym} (paid on ${from.name}). ` +
    `This is the LayerZero messaging fee and must be sent as the transaction value.`
  );

  // Without an amount + recipient we can only describe the route, not build a tx.
  if (!args.amount || !args.recipient) {
    notes.push('Provide `amount` and `recipient` to get a ready-to-sign transaction.');
    return { ok: true, message: `Route ${from.name} → ${to.name} is available.`, route, notes };
  }

  // Resolve token decimals (accuracy matters — wrong decimals = wrong amount).
  let decimals = args.decimals;
  if (decimals === undefined) {
    const hex = await rpcCall(from.key, route.token, DECIMALS_SELECTOR);
    const d = decodeUint(hex);
    if (d === null) {
      return {
        ok: false,
        message: `Could not read the token's decimals automatically. Pass \`decimals\` explicitly to build the transaction safely.`,
        route,
      };
    }
    decimals = d;
  }

  let amountWei: bigint;
  try {
    amountWei = parseUnits(args.amount, decimals);
  } catch (e: any) {
    return { ok: false, message: e.message, route };
  }
  if (amountWei <= 0n) return { ok: false, message: 'Amount must be greater than zero.', route };

  const data = encodeSendCalldata({
    selector: r.selector,
    pointer: Number(r.pointer),
    dstEid: route.dstEid,
    recipient: args.recipient,
    amountWei,
    nativeFee: BigInt(route.nativeFee),
  });

  const bridgeTransaction: EvmTransaction = {
    to: route.oftContract,
    data,
    value: route.nativeFee,
    chainId: from.chainId,
    description: `Bridge ${args.amount} tokens from ${from.name} to ${to.name} via the OFT contract.`,
  };

  const result: BuildResult = {
    ok: true,
    message: `Ready-to-sign transaction built for ${from.name} → ${to.name}.`,
    route,
    bridgeTransaction,
    notes,
  };

  // If the OFT is a separate adapter (token !== OFT), the adapter must be
  // approved to move the ERC-20 first. Provide that transaction too.
  if (!route.tokenIsOft && route.token !== ZERO) {
    result.approvalTransaction = {
      to: route.token,
      data: encodeApprove(route.oftContract, amountWei),
      value: '0',
      chainId: from.chainId,
      description: `Approve the bridge adapter (${route.oftContract}) to spend ${args.amount} of the token. Sign this BEFORE the bridge transaction.`,
    };
    notes.push(
      'This token bridges through a separate adapter contract, so an ERC-20 approval is required first. ' +
      'Sign `approvalTransaction`, wait for it to confirm, then sign `bridgeTransaction`.'
    );
  }

  return result;
}
