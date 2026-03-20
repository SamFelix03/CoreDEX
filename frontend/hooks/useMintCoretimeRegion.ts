"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ASSET_HUB_CHAIN_ID } from "@/constants";
import { CORETIME_NFT_ABI, coretimeNftContract } from "@/lib/coretimeNft";
import { parseMintedErc721TokenIdFromReceipt } from "@/lib/parseMintedNftFromReceipt";
import { heavyTxGas } from "@/lib/txGas";

/**
 * Same as Hardhat scripts (`mint-demo-region.ts`, `test-forwardmarket-individual.ts`):
 * `mintRegion.staticCall(...)` → next token id. On viem this is `simulateContract`.
 * PVM Coretime NFT may not emit standard ERC-721 `Transfer` logs, so we do not rely on receipts for the id.
 */
export function useMintCoretimeRegion() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: ASSET_HUB_CHAIN_ID });
  const { writeContractAsync, data: hash, isPending, error: writeError, reset: resetWagmi } =
    useWriteContract();

  const [mintedTokenId, setMintedTokenId] = useState<bigint | undefined>();
  /** Token id from the same `simulateContract` call that matched the tx args (set right before `writeContract`). */
  const pendingIdFromSimulation = useRef<bigint | undefined>(undefined);

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

  useEffect(() => {
    if (!isSuccess || !address) return;

    const fromSimulation = pendingIdFromSimulation.current;
    if (fromSimulation !== undefined) {
      setMintedTokenId(fromSimulation);
      pendingIdFromSimulation.current = undefined;
      return;
    }

    if (receipt) {
      const fromLogs = parseMintedErc721TokenIdFromReceipt(receipt, coretimeNftContract.address, address);
      if (fromLogs !== undefined) setMintedTokenId(fromLogs);
    }
  }, [isSuccess, receipt, address]);

  const reset = useCallback(() => {
    pendingIdFromSimulation.current = undefined;
    setMintedTokenId(undefined);
    resetWagmi();
  }, [resetWagmi]);

  const mint = useCallback(async () => {
    if (!address) throw new Error("Connect your wallet first");
    if (!publicClient) throw new Error("No RPC client for Polkadot Hub TestNet");

    const nowSec = Math.floor(Date.now() / 1000);
    const regionBegin = 900_000 + nowSec;
    const regionEnd = regionBegin + 100_000;
    const cores = 1 as const;

    const { request, result } = await publicClient.simulateContract({
      address: coretimeNftContract.address,
      abi: CORETIME_NFT_ABI,
      functionName: "mintRegion",
      args: [address, regionBegin, regionEnd, cores],
      account: address,
    });

    const tokenId = result as bigint;
    pendingIdFromSimulation.current = tokenId;

    try {
      return await writeContractAsync({
        ...request,
        chainId: ASSET_HUB_CHAIN_ID,
        ...heavyTxGas(),
      });
    } catch (e) {
      pendingIdFromSimulation.current = undefined;
      throw e;
    }
  }, [address, publicClient, writeContractAsync]);

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
