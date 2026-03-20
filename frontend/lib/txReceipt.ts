import { ASSET_HUB_CHAIN_ID } from "@/constants";

/** How often to poll `eth_getTransactionReceipt` while waiting (Hub ~12s blocks — 2s feels responsive). */
export const HUB_TX_RECEIPT_POLL_MS = 2_000;

/**
 * Pass into wagmi `useWaitForTransactionReceipt` alongside `hash` + `query.enabled`.
 * Without `chainId`, receipt polling can target the wrong chain and stay “loading” forever
 * when writes use `chainId: ASSET_HUB_CHAIN_ID` explicitly.
 */
export const hubWaitForTransactionReceiptProps = {
  chainId: ASSET_HUB_CHAIN_ID,
  pollingInterval: HUB_TX_RECEIPT_POLL_MS,
} as const;
