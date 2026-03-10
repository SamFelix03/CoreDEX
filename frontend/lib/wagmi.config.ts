import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { ASSET_HUB_CHAIN_ID } from "@/constants";

export const assetHubWestend = defineChain({
  id:   ASSET_HUB_CHAIN_ID,
  name: "Asset Hub Westend",
  nativeCurrency: { name: "WND", symbol: "WND", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://westend-asset-hub-eth-rpc.polkadot.io"] },
    public:  { http: ["https://westend-asset-hub-eth-rpc.polkadot.io"] },
  },
  blockExplorers: {
    default: { name: "Subscan", url: "https://assethub-westend.subscan.io" },
  },
  testnet: true,
});

export const assetHubPolkadot = defineChain({
  id:   420420420,
  name: "Asset Hub Polkadot",
  nativeCurrency: { name: "DOT", symbol: "DOT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://polkadot-asset-hub-rpc.polkadot.io"] },
    public:  { http: ["https://polkadot-asset-hub-rpc.polkadot.io"] },
  },
  blockExplorers: {
    default: { name: "Subscan", url: "https://assethub-polkadot.subscan.io" },
  },
});

// Use a placeholder projectId during build time to avoid errors.
// Replace with your real WalletConnect Cloud projectId in .env.local:
//   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000";

export const wagmiConfig = getDefaultConfig({
  appName:   "CoreDEX",
  projectId,
  chains:    [assetHubWestend, assetHubPolkadot],
  ssr:       true,
});
