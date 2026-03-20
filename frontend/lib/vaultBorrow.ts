/**
 * Mirrors `YieldVault.borrow` fee math:
 * `fee = coreCount * durationBlocks * currentLendingRate / RATE_PRECISION`
 * (Solidity truncates toward zero — same as bigint division).
 */
export const VAULT_RATE_PRECISION = 10n ** 18n;

export function computeVaultBorrowFee(
  coreCount: number,
  durationBlocks: number,
  currentLendingRate: bigint
): bigint {
  return (BigInt(coreCount) * BigInt(durationBlocks) * currentLendingRate) / VAULT_RATE_PRECISION;
}
