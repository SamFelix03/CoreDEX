/**
 * Gas overrides for Polkadot Hub TestNet — matches `smart-contracts/scripts/fill-charts-7d.ts` `txOpts()`
 * and `mint-demo-region.ts` (default 12_000_000 when `GAS_LIMIT` unset).
 *
 * - Set `NEXT_PUBLIC_TX_GAS_LIMIT` to a positive number to use that limit on "heavy" txs.
 * - Set `NEXT_PUBLIC_TX_GAS_LIMIT=0` to omit `gas` and let the wallet / node estimate (same as `GAS_LIMIT=0` in scripts).
 *
 * Set `NEXT_PUBLIC_TX_GAS_LIMIT=0` if the node rejects fixed limits on specific calls (rare).
 */
const DEFAULT_HEAVY_GAS = 12_000_000n;

export type TxGasOptions = { gas?: bigint };

export function heavyTxGas(): TxGasOptions {
  const raw = process.env.NEXT_PUBLIC_TX_GAS_LIMIT;
  if (raw === "0" || raw === "") return {};
  if (raw !== undefined && raw.length > 0) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      return { gas: BigInt(Math.floor(n)) };
    }
  }
  return { gas: DEFAULT_HEAVY_GAS };
}

/** Let the wallet / RPC estimate gas (omit `gas`). Use when a fixed limit causes rejections. */
export function lightTxGas(): TxGasOptions {
  return {};
}
