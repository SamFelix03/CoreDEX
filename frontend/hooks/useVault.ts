import { useReadContract, useReadContracts, useWriteContract, useAccount, usePublicClient } from "wagmi";
import { maxUint256 } from "viem";
import { yieldVaultContract, assetsPrecompileContract } from "@/lib/contracts";
import { heavyTxGas } from "@/lib/txGas";
import { useCallback } from "react";
import type { VaultStats } from "@/types/protocol";
import { uint32Arg } from "@/lib/utils";
import { ASSET_HUB_CHAIN_ID } from "@/constants";
import { computeVaultBorrowFee } from "@/lib/vaultBorrow";
import { HUB_TX_RECEIPT_POLL_MS } from "@/lib/txReceipt";
import { useHubTransactionReceipt } from "@/hooks/useHubTransactionReceipt";

export function useVaultStats() {
  const { data, isLoading, error } = useReadContracts({
    contracts: [
      { ...yieldVaultContract, functionName: "totalDeposited" },
      { ...yieldVaultContract, functionName: "totalLent" },
      { ...yieldVaultContract, functionName: "currentEpoch" },
      { ...yieldVaultContract, functionName: "utilisationRate" },
      { ...yieldVaultContract, functionName: "currentLendingRate" },
      { ...yieldVaultContract, functionName: "availableRegions" },
    ],
  });

  const stats: VaultStats | undefined = data
    ? {
        totalDeposited:   (data[0]?.result as bigint) ?? 0n,
        totalLent:        (data[1]?.result as bigint) ?? 0n,
        currentEpoch:     (data[2]?.result as bigint) ?? 0n,
        utilisationRate:  (data[3]?.result as bigint) ?? 0n,
        lendingRate:      (data[4]?.result as bigint) ?? 0n,
        availableRegions: (data[5]?.result as bigint) ?? 0n,
      }
    : undefined;

  return { stats, isLoading, error };
}

export function useVaultDeposits(address?: `0x${string}`) {
  const { data: receiptIds } = useReadContract({
    ...yieldVaultContract,
    functionName: "getDepositorReceipts",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return { receiptIds: receiptIds as bigint[] | undefined };
}

export function useVaultDeposit() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending: isWritePending, error: writeError, reset } = useWriteContract();
  const { isConfirming, isSuccess, error } = useHubTransactionReceipt(hash, writeError);

  const deposit = useCallback(
    async (regionId: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      return writeContractAsync({
        ...yieldVaultContract,
        functionName: "deposit",
        args: [regionId],
        ...heavyTxGas(),
      });
    },
    [address, writeContractAsync]
  );

  return { deposit, hash, isPending: isWritePending || isConfirming, isSuccess, error, reset };
}

export function useVaultWithdraw() {
  const { writeContractAsync, data: hash, isPending: isWritePending, error: writeError, reset } = useWriteContract();
  const { isConfirming, isSuccess, error } = useHubTransactionReceipt(hash, writeError);

  const withdraw = useCallback(
    async (receiptId: bigint) => {
      return writeContractAsync({
        ...yieldVaultContract,
        functionName: "withdraw",
        args: [receiptId],
        ...heavyTxGas(),
      });
    },
    [writeContractAsync]
  );

  return { withdraw, hash, isPending: isWritePending || isConfirming, isSuccess, error, reset };
}

export function useVaultBorrow() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: ASSET_HUB_CHAIN_ID });
  const { writeContractAsync, data: hash, isPending: isWritePending, error: writeError, reset } = useWriteContract();
  const { isConfirming, isSuccess, error } = useHubTransactionReceipt(hash, writeError);

  /**
   * Same call shape as scripts (`borrow(coreCount, durationBlocks)` with uint32 args).
   * Fee uses `IAssetsPrecompile.transferFrom` from the user to the vault.
   *
   * **Production** Hub assets precompile: ERC-20 `allowance` / `approve` exist — we approve the vault when needed.
   * **CoreDEX PVM MockAssets** (`rust-contracts/mock_assets.rs`): implements `transferFrom` but **not**
   * `allowance` or `approve` (unknown selectors revert). Scripts rely on mock allowing contract `transferFrom`
   * without prior approval — so if `allowance` read fails, we skip approve and call `borrow` directly.
   */
  const borrow = useCallback(
    async (coreCount: bigint, durationBlocks: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      if (!publicClient) throw new Error("RPC client unavailable");

      const c32 = uint32Arg(coreCount);
      const d32 = uint32Arg(durationBlocks);

      const rate = await publicClient.readContract({
        ...yieldVaultContract,
        functionName: "currentLendingRate",
      });

      const fee = computeVaultBorrowFee(c32, d32, rate as bigint);

      let assetsSupportAllowance = true;
      let allowance = 0n;
      try {
        allowance = (await publicClient.readContract({
          ...assetsPrecompileContract,
          functionName: "allowance",
          args: [address, yieldVaultContract.address],
        })) as bigint;
      } catch {
        assetsSupportAllowance = false;
      }

      if (assetsSupportAllowance && allowance < fee) {
        const approveHash = await writeContractAsync({
          ...assetsPrecompileContract,
          functionName: "approve",
          args: [yieldVaultContract.address, maxUint256],
          ...heavyTxGas(),
        });
        await publicClient.waitForTransactionReceipt({
          hash: approveHash,
          pollingInterval: HUB_TX_RECEIPT_POLL_MS,
        });
      }

      return writeContractAsync({
        ...yieldVaultContract,
        functionName: "borrow",
        args: [c32, d32],
        ...heavyTxGas(),
      });
    },
    [address, publicClient, writeContractAsync]
  );

  return { borrow, hash, isPending: isWritePending || isConfirming, isSuccess, error, reset };
}

export function useClaimYield() {
  const { writeContractAsync, data: hash, isPending: isWritePending, error: writeError, reset } = useWriteContract();
  const { isConfirming, isSuccess, error } = useHubTransactionReceipt(hash, writeError);

  /** `epoch` must match on-chain `claimYield(uint256 receiptTokenId, uint256 epoch)` (e.g. a finalized past epoch). */
  const claimYield = useCallback(
    async (receiptTokenId: bigint, epoch: bigint) => {
      return writeContractAsync({
        ...yieldVaultContract,
        functionName: "claimYield",
        args: [receiptTokenId, epoch],
        ...heavyTxGas(),
      });
    },
    [writeContractAsync]
  );

  return { claimYield, hash, isPending: isWritePending || isConfirming, isSuccess, error, reset };
}

export function useReturnLoan() {
  const { writeContractAsync, data: hash, isPending: isWritePending, error: writeError, reset } = useWriteContract();
  const { isConfirming, isSuccess, error } = useHubTransactionReceipt(hash, writeError);

  const returnLoan = useCallback(
    async (loanId: bigint) => {
      return writeContractAsync({
        ...yieldVaultContract,
        functionName: "returnLoan",
        args: [loanId],
        ...heavyTxGas(),
      });
    },
    [writeContractAsync]
  );

  return { returnLoan, hash, isPending: isWritePending || isConfirming, isSuccess, error, reset };
}
