import { parseUnits } from "viem";

// ─── Chain ────────────────────────────────────────────────────────────────────
export const ASSET_HUB_CHAIN_ID   = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "420420417");
export const ASSET_HUB_RPC        = process.env.NEXT_PUBLIC_ASSET_HUB_RPC ?? "https://services.polkadothub-rpc.com/testnet";

// ─── Deployed Contracts (Polkadot Hub TestNet) ──────────────────────────────
export const REGISTRY_ADDRESS        = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS        ?? "0x26D215752f68bc2254186F9f6FF068b8C4BdFd37") as `0x${string}`;
export const CORETIME_LEDGER_ADDRESS = (process.env.NEXT_PUBLIC_CORETIME_LEDGER_ADDRESS ?? "0x14d42947929F1ECf882aA6a07dd4279ADb49345d") as `0x${string}`;
export const FORWARD_MARKET_ADDRESS  = (process.env.NEXT_PUBLIC_FORWARD_MARKET_ADDRESS  ?? "0x9F0BF4aE6BBfD51eDbff77eA0D17A7bec484bb97") as `0x${string}`;
export const OPTIONS_ENGINE_ADDRESS  = (process.env.NEXT_PUBLIC_OPTIONS_ENGINE_ADDRESS  ?? "0xF9185161C5CF3577b2dD5D4E69c7f2a97be81e5A") as `0x${string}`;
export const YIELD_VAULT_ADDRESS     = (process.env.NEXT_PUBLIC_YIELD_VAULT_ADDRESS     ?? "0xdc6931da04eD65fd66CF1cb699458B4f6DB8271B") as `0x${string}`;
export const SETTLEMENT_ADDRESS      = (process.env.NEXT_PUBLIC_SETTLEMENT_ADDRESS      ?? "0x0866f40D55E96b2D74995203Caff032aD81c14B0") as `0x${string}`;

// ─── Precompiles (pallet-revive fixed addresses) ────────────────────────────
export const CORETIME_NFT_PRECOMPILE   = "0x0000000000000000000000000000000000000805" as `0x${string}`;
export const ASSETS_PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000806" as `0x${string}`;
export const XCM_PRECOMPILE_ADDRESS    = "0x0000000000000000000000000000000000000808" as `0x${string}`;
export const CORETIME_ORACLE_ADDRESS   = "0x0000000000000000000000000000000000002001" as `0x${string}`;
export const PRICING_MODULE_ADDRESS    = "0x0000000000000000000000000000000000002002" as `0x${string}`;

// ─── Parachains ─────────────────────────────────────────────────────────────
export const CORETIME_PARA_ID   = 1005;
export const ASSET_HUB_PARA_ID  = 1000;

// ─── Token ──────────────────────────────────────────────────────────────────
export const DOT_DECIMALS  = 18;
export const PRECISION     = parseUnits("1", 18);

// ─── Protocol ───────────────────────────────────────────────────────────────
export const GRACE_PERIOD       = 14_400n;       // blocks
export const PRICE_BAND_PCT     = 50n;           // percent
export const RECOVERY_TIMEOUT   = 14_400n;       // blocks
export const EPOCH_BLOCKS       = 50_400n;       // ~7 days at 12s blocks
export const BPS_DENOMINATOR    = 10_000n;
