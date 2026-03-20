import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { ASSET_HUB_CHAIN_ID } from "@/constants";

export const polkadotHubTestnet = defineChain({
  id:   ASSET_HUB_CHAIN_ID,
  name: "Polkadot Hub TestNet",
  nativeCurrency: { name: "PAS", symbol: "PAS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://services.polkadothub-rpc.com/testnet"] },
    public:  { http: ["https://services.polkadothub-rpc.com/testnet"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://blockscout-testnet.polkadot.io" },
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
  chains:    [polkadotHubTestnet, assetHubPolkadot],
  ssr:       true,
});
