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
    // Use `== null` so block number `0n` (genesis) is still valid — `!block.number` wrongly treats 0n as missing.
    if (block == null || block.number == null || block.timestamp == null) {
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
        latestBlockNumber: BigInt(block.number),
        latestBlockTimestamp: BigInt(block.timestamp),
        estimatedBlock: null,
        error: null,
        isLoadingHead: false,
      };
    }

    const currentBlock = BigInt(block.number);
    const latestBlockTimestamp = BigInt(block.timestamp);

    const { estimatedBlock, error } = estimateRelayBlockAtTime({
      targetTimeMs,
      currentBlock,
      latestBlockTimestamp,
    });

    return {
      latestBlockNumber: currentBlock,
      latestBlockTimestamp,
      estimatedBlock,
      error,
      isLoadingHead: false,
    };
  }, [block?.number, block?.timestamp, targetTimeMs, isLoading]);
}
