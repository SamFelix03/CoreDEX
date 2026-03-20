import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { forwardMarketContract } from "@/lib/contracts";
import { ASSET_HUB_CHAIN_ID } from "@/constants";
import { heavyTxGas } from "@/lib/txGas";
import { useCallback } from "react";
import type { ForwardOrder } from "@/types/protocol";
import { uint32Arg } from "@/lib/utils";
import { parseForwardOrderRead } from "@/lib/decodeEvmStructs";

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
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  const createAsk = useCallback(
    async (regionId: bigint, strikePriceDOT: bigint, deliveryBlock: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      return writeContractAsync({
        chainId: ASSET_HUB_CHAIN_ID,
        account: address,
        ...forwardMarketContract,
        functionName: "createAsk",
        args: [regionId, strikePriceDOT, uint32Arg(deliveryBlock)],
        ...heavyTxGas(),
      });
    },
    [address, writeContractAsync]
  );

  return { createAsk, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}

export function useMatchOrder() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  const matchOrder = useCallback(
    async (orderId: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      return writeContractAsync({
        chainId: ASSET_HUB_CHAIN_ID,
        account: address,
        ...forwardMarketContract,
        functionName: "matchOrder",
        args: [orderId],
        ...heavyTxGas(),
      });
    },
    [address, writeContractAsync]
  );

  return { matchOrder, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}

export function useSettleForward() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  const settle = useCallback(
    async (orderId: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      return writeContractAsync({
        chainId: ASSET_HUB_CHAIN_ID,
        account: address,
        ...forwardMarketContract,
        functionName: "settle",
        args: [orderId],
        ...heavyTxGas(),
      });
    },
    [address, writeContractAsync]
  );

  return { settle, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}

export function useCancelOrder() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  const cancel = useCallback(
    async (orderId: bigint) => {
      if (!address) throw new Error("Wallet not connected");
      return writeContractAsync({
        chainId: ASSET_HUB_CHAIN_ID,
        account: address,
        ...forwardMarketContract,
        functionName: "cancel",
        args: [orderId],
        ...heavyTxGas(),
      });
    },
    [address, writeContractAsync]
  );

  return { cancel, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}
