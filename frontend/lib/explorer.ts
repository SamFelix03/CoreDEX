import { ASSET_HUB_CHAIN_ID } from "@/constants";

/** Must stay in sync with `lib/wagmi.config.ts` chain ids / Subscan bases. */
const TX_EXPLORER_BASE_BY_CHAIN: Record<number, string> = {
  [ASSET_HUB_CHAIN_ID]: "https://assethub-westend.subscan.io",
  420420420: "https://assethub-polkadot.subscan.io",
};

export function getTxExplorerUrl(chainId: number, txHash: string): string | null {
  const base = TX_EXPLORER_BASE_BY_CHAIN[chainId];
  if (!base || !txHash?.startsWith("0x")) return null;
  return `${base}/tx/${txHash}`;
}
