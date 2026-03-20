"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useWaitForTransactionReceipt } from "wagmi";
import { hubWaitForTransactionReceiptProps } from "@/lib/txReceipt";
import { invalidateProtocolContractReads } from "@/lib/wagmiQueryInvalidate";

function toError(e: unknown): Error | null {
  if (e == null) return null;
  if (e instanceof Error) return e;
  if (typeof e === "object" && "shortMessage" in e && typeof (e as { shortMessage?: string }).shortMessage === "string") {
    return new Error((e as { shortMessage: string }).shortMessage);
  }
  if (typeof e === "object" && "message" in e) {
    return new Error(String((e as { message: unknown }).message));
  }
  return new Error(String(e));
}

/**
 * Hub receipt wait + immediate read invalidation.
 * `useWaitForTransactionReceipt`’s query `isSuccess` only means “receipt loaded”, not “tx succeeded”;
 * we expose `isSuccess` as **receipt.status === "success"** and surface reverts as `error`.
 */
export function useHubTransactionReceipt(hash: `0x${string}` | undefined, writeError: unknown) {
  const queryClient = useQueryClient();

  const {
    data: receipt,
    isLoading: isConfirming,
    error: receiptWaitError,
  } = useWaitForTransactionReceipt({
    hash,
    ...hubWaitForTransactionReceiptProps,
    query: { enabled: !!hash },
  });

  useEffect(() => {
    if (!receipt || !hash) return;
    void invalidateProtocolContractReads(queryClient);
  }, [receipt?.blockHash, hash, queryClient]);

  const isReverted = receipt?.status === "reverted";
  const isSuccess = receipt?.status === "success";

  const error =
    toError(writeError) ??
    toError(receiptWaitError) ??
    (isReverted ? new Error("Transaction reverted on-chain") : null);

  return { receipt, isConfirming, isSuccess, error };
}
