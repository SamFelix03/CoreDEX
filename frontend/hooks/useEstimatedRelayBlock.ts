"use client";

import { useMemo } from "react";
import { useBlock } from "wagmi";
import { ASSET_HUB_CHAIN_ID } from "@/constants";
import { estimateRelayBlockAtTime } from "@/lib/relayBlockEstimate";

/**
 * Estimates the relay block height for a future wall-clock instant from the latest chain head.
 */
export function useEstimatedRelayBlock(targetTimeMs: number | null) {
  const { data: block, isLoading } = useBlock({
    chainId: ASSET_HUB_CHAIN_ID,
    blockTag: "latest",
    watch: true,
  });

  return useMemo(() => {
    if (!block?.number || block.timestamp === undefined) {
      return {
        latestBlockNumber: null as bigint | null,
        latestBlockTimestamp: null as bigint | null,
        estimatedBlock: null as bigint | null,
        error: null as string | null,
        isLoadingHead: isLoading,
      };
    }

    if (targetTimeMs === null || !Number.isFinite(targetTimeMs)) {
      return {
        latestBlockNumber: block.number,
        latestBlockTimestamp: block.timestamp,
        estimatedBlock: null,
        error: null,
        isLoadingHead: false,
      };
    }

    const { estimatedBlock, error } = estimateRelayBlockAtTime({
      targetTimeMs,
      currentBlock: block.number,
      latestBlockTimestamp: block.timestamp,
    });

    return {
      latestBlockNumber: block.number,
      latestBlockTimestamp: block.timestamp,
      estimatedBlock,
      error,
      isLoadingHead: false,
    };
  }, [block?.number, block?.timestamp, targetTimeMs, isLoading]);
}
