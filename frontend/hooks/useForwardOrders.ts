import { useReadContract, useWriteContract, useAccount, usePublicClient } from "wagmi";
import { forwardMarketContract } from "@/lib/contracts";
import { ASSET_HUB_CHAIN_ID } from "@/constants";
import { heavyTxGas } from "@/lib/txGas";
import { useCallback } from "react";
import type { ForwardOrder } from "@/types/protocol";
import { uint32Arg } from "@/lib/utils";
import { parseForwardOrderRead } from "@/lib/decodeEvmStructs";
import { useHubTransactionReceipt } from "@/hooks/useHubTransactionReceipt";

/**
 * Viem needs `functionName` + `args` correlated; a generic single `simulateContract` call does not narrow.
 * Discriminated union + switch gives a well-typed simulate per write.
 */
type SimulateForwardMarketWrite =
  | { functionName: "createAsk"; args: readonly [bigint, bigint, number] }
  | { functionName: "matchOrder"; args: readonly [bigint] }
  | { functionName: "settle"; args: readonly [bigint] }
  | { functionName: "cancel"; args: readonly [bigint] };

async function simulateForwardWrite(
  publicClient: ReturnType<typeof usePublicClient>,
  address: `0x${string}`,
  call: SimulateForwardMarketWrite
) {
  if (!publicClient) {
    throw new Error("No RPC client for Polkadot Hub — cannot simulate transaction");
  }
  const base = {
    address: forwardMarketContract.address,
    abi: forwardMarketContract.abi,
    account: address,
  } as const;

  switch (call.functionName) {
    case "createAsk":
      await publicClient.simulateContract({
        ...base,
        functionName: "createAsk",
        args: call.args,
      });
      break;
    case "matchOrder":
      await publicClient.simulateContract({
        ...base,
        functionName: "matchOrder",
        args: call.args,
      });
      break;
    case "settle":
      await publicClient.simulateContract({
        ...base,
        functionName: "settle",
        args: call.args,
      });
      break;
    case "cancel":
      await publicClient.simulateContract({
        ...base,
        functionName: "cancel",
        args: call.args,
      });
      break;
  }
}

export function useForwardOrders(address?: `0x${string}`) {
  const { data: sellerOrderIds } = useReadContract({
    ...forwardMarketContract,
    functionName: "getSellerOrders",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: buyerOrderIds } = useReadContract({
    ...forwardMarketContract,
    functionName: "getBuyerOrders",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: nextOrderId } = useReadContract({
    ...forwardMarketContract,
    functionName: "nextOrderId",
  });

  return {
    sellerOrderIds: sellerOrderIds as bigint[] | undefined,
    buyerOrderIds:  buyerOrderIds as bigint[] | undefined,
    nextOrderId:    nextOrderId as bigint | undefined,
  };
}

export function useForwardOrder(orderId: bigint | undefined) {
  const { data, isLoading } = useReadContract({
    ...forwardMarketContract,
    functionName: "orders",
    args: orderId !== undefined ? [orderId] : undefined,
    query: { enabled: orderId !== undefined },
  });

  const order: ForwardOrder | undefined = parseForwardOrderRead(data);

  return { order, isLoading };
}

export function useCreateAsk() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: ASSET_HUB_CHAIN_ID });
  const { writeContractAsync, data: hash, isPending: isWritePending, error: writeError, reset } =
    useWriteContract();
  const { isConfirming, isSuccess, error } = useHubTransactionReceipt(hash, writeError);

  const createAsk = useCallback(
    async (regionId: bigint, strikePriceDOT: bigint, deliveryBlock: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      const args = [regionId, strikePriceDOT, uint32Arg(deliveryBlock)] as const;
      await simulateForwardWrite(publicClient, address, { functionName: "createAsk", args });
      return writeContractAsync({
        chainId: ASSET_HUB_CHAIN_ID,
        account: address,
        ...forwardMarketContract,
        functionName: "createAsk",
        args: [...args],
        ...heavyTxGas(),
      });
    },
    [address, publicClient, writeContractAsync]
  );

  return {
    createAsk,
    hash,
    isPending: isWritePending || isConfirming,
    isWritePending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useMatchOrder() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: ASSET_HUB_CHAIN_ID });
  const { writeContractAsync, data: hash, isPending: isWritePending, error: writeError, reset } =
    useWriteContract();
  const { isConfirming, isSuccess, error } = useHubTransactionReceipt(hash, writeError);

  const matchOrder = useCallback(
    async (orderId: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      const id = BigInt(orderId);
      const args = [id] as const;
      await simulateForwardWrite(publicClient, address, { functionName: "matchOrder", args });
      return writeContractAsync({
        chainId: ASSET_HUB_CHAIN_ID,
        account: address,
        ...forwardMarketContract,
        functionName: "matchOrder",
        args: [...args],
        ...heavyTxGas(),
      });
    },
    [address, publicClient, writeContractAsync]
  );

  return {
    matchOrder,
    hash,
    isPending: isWritePending || isConfirming,
    isWritePending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useSettleForward() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: ASSET_HUB_CHAIN_ID });
  const { writeContractAsync, data: hash, isPending: isWritePending, error: writeError, reset } =
    useWriteContract();
  const { isConfirming, isSuccess, error } = useHubTransactionReceipt(hash, writeError);

  const settle = useCallback(
    async (orderId: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      const id = BigInt(orderId);
      const args = [id] as const;
      await simulateForwardWrite(publicClient, address, { functionName: "settle", args });
      return writeContractAsync({
        chainId: ASSET_HUB_CHAIN_ID,
        account: address,
        ...forwardMarketContract,
        functionName: "settle",
        args: [...args],
        ...heavyTxGas(),
      });
    },
    [address, publicClient, writeContractAsync]
  );

  return {
    settle,
    hash,
    isPending: isWritePending || isConfirming,
    isWritePending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useCancelOrder() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: ASSET_HUB_CHAIN_ID });
  const { writeContractAsync, data: hash, isPending: isWritePending, error: writeError, reset } =
    useWriteContract();
  const { isConfirming, isSuccess, error } = useHubTransactionReceipt(hash, writeError);

  const cancel = useCallback(
    async (orderId: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      const id = BigInt(orderId);
      const args = [id] as const;
      await simulateForwardWrite(publicClient, address, { functionName: "cancel", args });
      return writeContractAsync({
        chainId: ASSET_HUB_CHAIN_ID,
        account: address,
        ...forwardMarketContract,
        functionName: "cancel",
        args: [...args],
        ...heavyTxGas(),
      });
    },
    [address, publicClient, writeContractAsync]
  );

  return {
    cancel,
    hash,
    isPending: isWritePending || isConfirming,
    isWritePending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
