import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { forwardMarketContract } from "@/lib/contracts";
import { heavyTxGas } from "@/lib/txGas";
import { useCallback } from "react";
import type { ForwardOrder } from "@/types/protocol";

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

  const d = data as unknown as unknown[] | undefined;
  const order: ForwardOrder | undefined = d
    ? {
        // Solidity tuple order from `ForwardMarket.orders(orderId)`:
        //   orderId, seller, buyer, regionId(uint128), strikePriceDOT(uint128),
        //   deliveryBlock(uint32), createdBlock(uint32), status(uint8)
        orderId:        d[0] as bigint,
        seller:         d[1] as string,
        buyer:          d[2] as string,
        regionId:       d[3] as bigint,
        strikePriceDOT: d[4] as bigint,
        deliveryBlock:  d[5] as bigint,
        createdBlock:   d[6] as bigint,
        status:         Number(d[7]),
      }
    : undefined;

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
        ...forwardMarketContract,
        functionName: "createAsk",
        args: [regionId, strikePriceDOT, deliveryBlock],
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
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  const settle = useCallback(
    async (orderId: bigint) => {
      return writeContractAsync({
        ...forwardMarketContract,
        functionName: "settle",
        args: [orderId],
        ...heavyTxGas(),
      });
    },
    [writeContractAsync]
  );

  return { settle, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}

export function useCancelOrder() {
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  const cancel = useCallback(
    async (orderId: bigint) => {
      return writeContractAsync({
        ...forwardMarketContract,
        functionName: "cancel",
        args: [orderId],
        ...heavyTxGas(),
      });
    },
    [writeContractAsync]
  );

  return { cancel, hash, isPending: isPending || isConfirming, isSuccess, error: writeError ?? receiptError, reset };
}
