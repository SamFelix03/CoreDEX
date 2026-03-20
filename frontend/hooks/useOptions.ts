import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { optionsEngineContract } from "@/lib/contracts";
import { ASSET_HUB_CHAIN_ID } from "@/constants";
import { heavyTxGas } from "@/lib/txGas";
import { useCallback } from "react";
import type { Option } from "@/types/protocol";
import { uint32Arg } from "@/lib/utils";
import { parseOptionRead } from "@/lib/decodeEvmStructs";
import { useHubTransactionReceipt } from "@/hooks/useHubTransactionReceipt";

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

  const option: Option | undefined = parseOptionRead(data);

  return { option, isLoading };
}

export function useWriteCall() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending: isWritePending, error: writeError, reset } = useWriteContract();
  const { isConfirming, isSuccess, error } = useHubTransactionReceipt(hash, writeError);

  const writeCall = useCallback(
    async (regionId: bigint, strikePriceDOT: bigint, expiryBlock: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      return writeContractAsync({
        chainId: ASSET_HUB_CHAIN_ID,
        account: address,
        ...optionsEngineContract,
        functionName: "writeCall",
        args: [regionId, strikePriceDOT, uint32Arg(expiryBlock)],
        ...heavyTxGas(),
      });
    },
    [address, writeContractAsync]
  );

  return {
    writeCall,
    hash,
    isPending: isWritePending || isConfirming,
    isWritePending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useWritePut() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending: isWritePending, error: writeError, reset } = useWriteContract();
  const { isConfirming, isSuccess, error } = useHubTransactionReceipt(hash, writeError);

  const writePut = useCallback(
    async (regionId: bigint, strikePriceDOT: bigint, expiryBlock: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      return writeContractAsync({
        chainId: ASSET_HUB_CHAIN_ID,
        account: address,
        ...optionsEngineContract,
        functionName: "writePut",
        args: [regionId, strikePriceDOT, uint32Arg(expiryBlock)],
        ...heavyTxGas(),
      });
    },
    [address, writeContractAsync]
  );

  return {
    writePut,
    hash,
    isPending: isWritePending || isConfirming,
    isWritePending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useBuyOption() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending: isWritePending, error: writeError, reset } = useWriteContract();
  const { isConfirming, isSuccess, error } = useHubTransactionReceipt(hash, writeError);

  const buyOption = useCallback(
    async (optionId: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      return writeContractAsync({
        chainId: ASSET_HUB_CHAIN_ID,
        account: address,
        ...optionsEngineContract,
        functionName: "buyOption",
        args: [optionId],
        ...heavyTxGas(),
      });
    },
    [address, writeContractAsync]
  );

  return {
    buyOption,
    hash,
    isPending: isWritePending || isConfirming,
    isWritePending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useExerciseOption() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending: isWritePending, error: writeError, reset } = useWriteContract();
  const { isConfirming, isSuccess, error } = useHubTransactionReceipt(hash, writeError);

  const exercise = useCallback(
    async (optionId: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      return writeContractAsync({
        chainId: ASSET_HUB_CHAIN_ID,
        account: address,
        ...optionsEngineContract,
        functionName: "exercise",
        args: [optionId],
        ...heavyTxGas(),
      });
    },
    [address, writeContractAsync]
  );

  return {
    exercise,
    hash,
    isPending: isWritePending || isConfirming,
    isWritePending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
