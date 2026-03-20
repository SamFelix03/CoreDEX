import { ASSET_HUB_CHAIN_ID } from "@/constants";

/**
 * EVM transaction URLs. Polkadot Hub TestNet uses Blockscout (see README / env override).
 * Override: `NEXT_PUBLIC_TX_EXPLORER_BASE=https://blockscout-testnet.polkadot.io`
 */
const TX_EXPLORER_BASE_BY_CHAIN: Record<number, string> = {
  [ASSET_HUB_CHAIN_ID]:
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_TX_EXPLORER_BASE) ||
    "https://blockscout-testnet.polkadot.io",
  420420420: "https://assethub-polkadot.subscan.io",
};

export function getTxExplorerUrl(chainId: number, txHash: string): string | null {
  const raw = TX_EXPLORER_BASE_BY_CHAIN[chainId];
  if (!raw || !txHash?.startsWith("0x")) return null;
  const base = raw.replace(/\/$/, "");
  return `${base}/tx/${txHash}`;
}
