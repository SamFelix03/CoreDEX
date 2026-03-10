import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { optionsEngineContract } from "@/lib/contracts";
import { useCallback } from "react";
import type { Option } from "@/types/protocol";

export function useOptionsData(address?: `0x${string}`) {
  const { data: writerOptionIds } = useReadContract({
    ...optionsEngineContract,
    functionName: "getWriterOptions",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: holderOptionIds } = useReadContract({
    ...optionsEngineContract,
    functionName: "getHolderOptions",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: nextOptionId } = useReadContract({
    ...optionsEngineContract,
    functionName: "nextOptionId",
  });

  return {
    writerOptionIds: writerOptionIds as bigint[] | undefined,
    holderOptionIds: holderOptionIds as bigint[] | undefined,
    nextOptionId:    nextOptionId as bigint | undefined,
  };
}

export function useOption(optionId: bigint | undefined) {
  const { data, isLoading } = useReadContract({
    ...optionsEngineContract,
    functionName: "options",
    args: optionId !== undefined ? [optionId] : undefined,
    query: { enabled: optionId !== undefined },
  });

  const d = data as unknown as unknown[] | undefined;
  const option: Option | undefined = d
    ? {
        optionId:       optionId!,
        writer:         d[0] as string,
        holder:         d[1] as string,
        optionType:     Number(d[2]),
        coretimeRegion: d[3] as bigint,
        strikePriceDOT: d[4] as bigint,
        premiumDOT:     d[5] as bigint,
        expiryBlock:    d[6] as bigint,
        status:         Number(d[7]),
        createdBlock:   d[8] as bigint,
      }
    : undefined;

  return { option, isLoading };
}

export function useWriteCall() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  const writeCall = useCallback(
    async (regionId: bigint, strikePriceDOT: bigint, expiryBlock: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      return writeContractAsync({
        ...optionsEngineContract,
        functionName: "writeCall",
        args: [regionId, strikePriceDOT, expiryBlock],
      });
    },
    [address, writeContractAsync]
  );

  return { writeCall, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}

export function useWritePut() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  const writePut = useCallback(
    async (regionId: bigint, strikePriceDOT: bigint, expiryBlock: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      return writeContractAsync({
        ...optionsEngineContract,
        functionName: "writePut",
        args: [regionId, strikePriceDOT, expiryBlock],
      });
    },
    [address, writeContractAsync]
  );

  return { writePut, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}

export function useBuyOption() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  const buyOption = useCallback(
    async (optionId: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      return writeContractAsync({
        ...optionsEngineContract,
        functionName: "buyOption",
        args: [optionId],
      });
    },
    [address, writeContractAsync]
  );

  return { buyOption, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}

export function useExerciseOption() {
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  const exercise = useCallback(
    async (optionId: bigint) => {
      return writeContractAsync({
        ...optionsEngineContract,
        functionName: "exercise",
        args: [optionId],
      });
    },
    [writeContractAsync]
  );

  return { exercise, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}
