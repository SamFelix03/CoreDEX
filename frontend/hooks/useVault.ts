import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { yieldVaultContract } from "@/lib/contracts";
import { heavyTxGas } from "@/lib/txGas";
import { useCallback } from "react";
import type { VaultStats } from "@/types/protocol";
import { uint32Arg } from "@/lib/utils";

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
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

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

  return { deposit, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}

export function useVaultWithdraw() {
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

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

  return { withdraw, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}

export function useVaultBorrow() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  const borrow = useCallback(
    async (coreCount: bigint, durationBlocks: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      return writeContractAsync({
        ...yieldVaultContract,
        functionName: "borrow",
        args: [uint32Arg(coreCount), uint32Arg(durationBlocks)],
        ...heavyTxGas(),
      });
    },
    [address, writeContractAsync]
  );

  return { borrow, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}

export function useClaimYield() {
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

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

  return { claimYield, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}

export function useReturnLoan() {
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

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

  return { returnLoan, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}
