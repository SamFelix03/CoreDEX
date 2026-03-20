import { parseUnits } from "viem";

// ─── Chain ────────────────────────────────────────────────────────────────────
export const ASSET_HUB_CHAIN_ID   = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "420420417");
export const ASSET_HUB_RPC        = process.env.NEXT_PUBLIC_ASSET_HUB_RPC ?? "https://services.polkadothub-rpc.com/testnet";

// ─── Deployed Contracts (Polkadot Hub TestNet) ──────────────────────────────
export const REGISTRY_ADDRESS        = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS        ?? "0x26D215752f68bc2254186F9f6FF068b8C4BdFd37") as `0x${string}`;
export const CORETIME_LEDGER_ADDRESS = (process.env.NEXT_PUBLIC_CORETIME_LEDGER_ADDRESS ?? "0x14d42947929F1ECf882aA6a07dd4279ADb49345d") as `0x${string}`;
export const FORWARD_MARKET_ADDRESS  = (process.env.NEXT_PUBLIC_FORWARD_MARKET_ADDRESS  ?? "0x7000469F063Da54d23965Ba254CAA77CCC3E0D1c") as `0x${string}`;
export const OPTIONS_ENGINE_ADDRESS  = (process.env.NEXT_PUBLIC_OPTIONS_ENGINE_ADDRESS  ?? "0xAA1c5a2ae781506B8629E7ADdBdB8650254ba59e") as `0x${string}`;
export const YIELD_VAULT_ADDRESS     = (process.env.NEXT_PUBLIC_YIELD_VAULT_ADDRESS     ?? "0x790294681B3A8475DcF791f158D42Eb961dD8553") as `0x${string}`;
export const SETTLEMENT_ADDRESS      = (process.env.NEXT_PUBLIC_SETTLEMENT_ADDRESS      ?? "0xf2dF3Ea8C0c802678c427e4D280D48c00AC040f3") as `0x${string}`;

// ─── PVM Mock Contracts (deployed Rust PVM on Polkadot Hub TestNet) ──────────
// These Rust PVM contracts provide the same ABI as future runtime precompiles.
// Cross-VM calls from the Solidity EVM contracts reach these transparently.
export const CORETIME_ORACLE_ADDRESS   = (process.env.NEXT_PUBLIC_CORETIME_ORACLE_ADDRESS   ?? "0xE1f895FcA63839401C3d0Cc2F194b1ae9902CB8A") as `0x${string}`;
export const PRICING_MODULE_ADDRESS    = (process.env.NEXT_PUBLIC_PRICING_MODULE_ADDRESS    ?? "0xCFAF1e5a2df41738472029869Be7fA5e375C7A1f") as `0x${string}`;
export const CORETIME_NFT_PRECOMPILE   = (process.env.NEXT_PUBLIC_CORETIME_NFT_ADDRESS      ?? "0x2fc7308a6D40c68fc47990eD29656fF7c8F6FBB2") as `0x${string}`;
export const ASSETS_PRECOMPILE_ADDRESS = (process.env.NEXT_PUBLIC_ASSETS_ADDRESS            ?? "0xc82e04234549D48b961d8Cb3F3c60609dDF3F006") as `0x${string}`;

// ─── Real Polkadot Precompiles ──────────────────────────────────────────────
export const XCM_PRECOMPILE_ADDRESS    = "0x00000000000000000000000000000000000a0000" as `0x${string}`;

// ─── Parachains ─────────────────────────────────────────────────────────────
export const CORETIME_PARA_ID   = 1005;
export const ASSET_HUB_PARA_ID  = 1000;

// ─── Token ──────────────────────────────────────────────────────────────────
export const DOT_DECIMALS  = 18;
export const PRECISION     = parseUnits("1", 18);

// ─── Protocol ───────────────────────────────────────────────────────────────
/** UI-only strike bounds (DOT planck). On-chain still uses oracle ± band — keep spot in ~5 DOT range for testnet. */
export const UI_STRIKE_MIN_WEI = parseUnits("2.5", DOT_DECIMALS);
export const UI_STRIKE_MAX_WEI = parseUnits("7.5", DOT_DECIMALS);

export const GRACE_PERIOD       = 14_400n;       // blocks
export const PRICE_BAND_PCT     = 50n;           // percent
export const RECOVERY_TIMEOUT   = 14_400n;       // blocks
export const EPOCH_BLOCKS       = 50_400n;       // ~7 days at 12s blocks
export const BPS_DENOMINATOR    = 10_000n;

/** Hub / relay-style assumption for mapping wall-clock → block height in the UI (Solidity uses uint32 for many block fields). */
export const RELAY_BLOCK_TIME_SECONDS = 12;
export const RELAY_BLOCK_UINT32_MAX     = 4_294_967_295n;

/**
 * `ForwardMarket.createAsk` / `OptionsEngine` use `block.number` on the **EVM** (Hub) RPC.
 * Wall-clock estimates can sit on a different scale than that number and end up **below** the real head
 * → instant `DeliveryBlockInPast` with tiny gas use. Hardhat scripts always use `head + 10_000` instead.
 */
export const MIN_EVM_BLOCK_LEAD = 10_000n;
