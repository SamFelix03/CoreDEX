"use client";

import { useCallback } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ASSET_HUB_CHAIN_ID } from "@/constants";
import { CORETIME_NFT_ABI, coretimeNftContract } from "@/lib/coretimeNft";

/** PVM mint can need a high gas limit (matches Hardhat demo script default). */
const MINT_GAS = 12_000_000n;

export function useMintCoretimeRegion() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

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
      gas: MINT_GAS,
      chainId: ASSET_HUB_CHAIN_ID,
    });
  }, [address, writeContractAsync]);

  return {
    mint,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error: writeError ?? receiptError,
    reset,
  };
}
