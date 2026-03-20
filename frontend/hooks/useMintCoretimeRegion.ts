"use client";

import { useCallback, useMemo } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ASSET_HUB_CHAIN_ID } from "@/constants";
import { CORETIME_NFT_ABI, coretimeNftContract } from "@/lib/coretimeNft";
import { parseMintedErc721TokenIdFromReceipt } from "@/lib/parseMintedNftFromReceipt";
import { heavyTxGas } from "@/lib/txGas";

export function useMintCoretimeRegion() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
    chainId: ASSET_HUB_CHAIN_ID,
    query: { enabled: !!hash },
  });

  const mintedTokenId = useMemo(() => {
    if (!isSuccess || !receipt || !address) return undefined;
    return parseMintedErc721TokenIdFromReceipt(receipt, coretimeNftContract.address, address);
  }, [isSuccess, receipt, address]);

  const mint = useCallback(async () => {
    if (!address) throw new Error("Connect your wallet first");
    const nowSec = Math.floor(Date.now() / 1000);
    const regionBegin = 900_000 + nowSec;
    const regionEnd = regionBegin + 100_000;
    const cores = 1 as const;
    return writeContractAsync({
      address: coretimeNftContract.address,
      abi: CORETIME_NFT_ABI,
      functionName: "mintRegion",
      args: [address, regionBegin, regionEnd, cores],
      chainId: ASSET_HUB_CHAIN_ID,
      ...heavyTxGas(),
    });
  }, [address, writeContractAsync]);

  return {
    mint,
    hash,
    mintedTokenId,
    isPending: isPending || isConfirming,
    isSuccess,
    error: writeError ?? receiptError,
    reset,
  };
}
