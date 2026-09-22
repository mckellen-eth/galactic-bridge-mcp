// Pure calldata builders — no dependencies, no network, no keys.
// The send() layout mirrors the bridge frontend's encoder exactly: the selector
// and pointer come from the route the API resolved, never hardcoded.

const p = (v: bigint): string => v.toString(16).padStart(64, '0');
const pAddr = (a: string): string => '000000000000000000000000' + a.toLowerCase().replace(/^0x/, '');

export interface SendLayout {
  selector: string;   // e.g. "c7c7f5b3" (no 0x)
  pointer: number;    // 96 (0x60) or 128 (0x80)
  dstEid: number;
  recipient: string;  // 0x… address (receiver + refund)
  amountWei: bigint;
  nativeFee: bigint;
}

/** Build the OFT send() calldata. Matches the bridge's LayerZero V2 layout. */
export function encodeSendCalldata(l: SendLayout): string {
  const topLevel =
    p(BigInt(l.pointer)) +   // slot 0: pointer to sendParam
    p(l.nativeFee) +         // slot 1: nativeFee
    p(0n) +                  // slot 2: lzTokenFee
    pAddr(l.recipient);      // slot 3: refundAddress

  const sendParam =
    p(BigInt(l.dstEid)) +    // dstEid
    pAddr(l.recipient) +     // to (bytes32)
    p(l.amountWei) +         // amountLD
    p(l.amountWei) +         // minAmountLD
    p(0xe0n) +               // offset extraOptions
    p(0x100n) +              // offset composeMsg
    p(0x120n) +              // offset oftCmd
    p(0n) +                  // extraOptions len
    p(0n) +                  // composeMsg len
    p(0n);                   // oftCmd len

  return '0x' + l.selector.replace(/^0x/, '') + topLevel + sendParam;
}

/** ERC-20 approve(spender, amount) calldata. Needed when the OFT is a separate adapter. */
export function encodeApprove(spender: string, amountWei: bigint): string {
  return '0x095ea7b3' + pAddr(spender) + p(amountWei);
}

/** decimals() call selector. */
export const DECIMALS_SELECTOR = '0x313ce567';

/** Parse a human amount string ("12.5") into base units, without floating point. */
export function parseUnits(amount: string, decimals: number): bigint {
  const s = String(amount).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`Invalid amount: "${amount}"`);
  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) {
    throw new Error(`Amount has more decimal places (${frac.length}) than the token supports (${decimals}).`);
  }
  const padded = frac.padEnd(decimals, '0');
  return BigInt(whole + padded);
}

/** Decode a uint returned by an eth_call (hex string) into a number. */
export function decodeUint(hex: string | null): number | null {
  if (!hex || hex === '0x') return null;
  try {
    return Number(BigInt(hex));
  } catch {
    return null;
  }
}
