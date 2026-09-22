// The 14 EVM networks Galactic Bridge supports.
// Mirrors the bridge's own chain list (key, chainId, LayerZero V2 eid, native symbol).
// `defaultRpc` is used ONLY by the optional signer add-on to broadcast a signed
// transaction; the read/build tools never touch it — they call the bridge API.

export interface Network {
  key: string;
  name: string;
  chainId: number;
  eid: number;
  nativeSym: string;
  explorerUrl: string;
  defaultRpc: string;
}

export const NETWORKS: Record<string, Network> = {
  eth:       { key: 'eth',       name: 'Ethereum',  chainId: 1,     eid: 30101, nativeSym: 'ETH',  explorerUrl: 'https://etherscan.io',                 defaultRpc: 'https://eth.llamarpc.com' },
  bsc:       { key: 'bsc',       name: 'BNB Chain', chainId: 56,    eid: 30102, nativeSym: 'BNB',  explorerUrl: 'https://bscscan.com',                  defaultRpc: 'https://bsc-dataseed.binance.org' },
  base:      { key: 'base',      name: 'Base',      chainId: 8453,  eid: 30184, nativeSym: 'ETH',  explorerUrl: 'https://basescan.org',                 defaultRpc: 'https://mainnet.base.org' },
  arb:       { key: 'arb',       name: 'Arbitrum',  chainId: 42161, eid: 30110, nativeSym: 'ETH',  explorerUrl: 'https://arbiscan.io',                  defaultRpc: 'https://arb1.arbitrum.io/rpc' },
  poly:      { key: 'poly',      name: 'Polygon',   chainId: 137,   eid: 30109, nativeSym: 'POL',  explorerUrl: 'https://polygonscan.com',              defaultRpc: 'https://polygon-rpc.com' },
  op:        { key: 'op',        name: 'Optimism',  chainId: 10,    eid: 30111, nativeSym: 'ETH',  explorerUrl: 'https://optimistic.etherscan.io',      defaultRpc: 'https://mainnet.optimism.io' },
  avax:      { key: 'avax',      name: 'Avalanche', chainId: 43114, eid: 30106, nativeSym: 'AVAX', explorerUrl: 'https://snowtrace.io',                 defaultRpc: 'https://api.avax.network/ext/bc/C/rpc' },
  mantle:    { key: 'mantle',    name: 'Mantle',    chainId: 5000,  eid: 30181, nativeSym: 'MNT',  explorerUrl: 'https://mantlescan.xyz',               defaultRpc: 'https://rpc.mantle.xyz' },
  hyperevm:  { key: 'hyperevm',  name: 'HyperEVM',  chainId: 999,   eid: 30367, nativeSym: 'HYPE', explorerUrl: 'https://hyperevmscan.io',              defaultRpc: 'https://rpc.hyperliquid.xyz/evm' },
  ink:       { key: 'ink',       name: 'Ink',       chainId: 57073, eid: 30339, nativeSym: 'ETH',  explorerUrl: 'https://explorer.inkonchain.com',      defaultRpc: 'https://rpc-gel.inkonchain.com' },
  xlayer:    { key: 'xlayer',    name: 'X Layer',   chainId: 196,   eid: 30274, nativeSym: 'OKB',  explorerUrl: 'https://www.oklink.com/xlayer',        defaultRpc: 'https://rpc.xlayer.tech' },
  plasma:    { key: 'plasma',    name: 'Plasma',    chainId: 9745,  eid: 30383, nativeSym: 'XPL',  explorerUrl: 'https://plasmascan.to',                defaultRpc: 'https://rpc.plasma.to' },
  robinhood: { key: 'robinhood', name: 'Robinhood', chainId: 4663,  eid: 30416, nativeSym: 'ETH',  explorerUrl: 'https://robinhoodchain.blockscout.com', defaultRpc: '' },
  arc:       { key: 'arc',       name: 'Arc',       chainId: 5042,  eid: 30417, nativeSym: 'USDC', explorerUrl: 'https://arcscan.app',                  defaultRpc: 'https://rpc.mainnet.arc.io' },
};

export const NETWORK_KEYS = Object.keys(NETWORKS);

export function getNetwork(key: string): Network | undefined {
  return NETWORKS[key];
}
