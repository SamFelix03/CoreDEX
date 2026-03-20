import type { PublicClient } from "viem";
import {
  MIN_EVM_BLOCK_LEAD,
  RELAY_BLOCK_TIME_SECONDS,
  RELAY_BLOCK_UINT32_MAX,
} from "@/constants";

/**
 * Map a wall-clock instant to an estimated relay-chain block number using the latest
 * known block and its timestamp. Contracts still receive a concrete `uint32` block.
 */
export function estimateRelayBlockAtTime({
  targetTimeMs,
  currentBlock,
  latestBlockTimestamp,
}: {
  targetTimeMs: number;
  currentBlock: bigint;
  latestBlockTimestamp: bigint;
}): { estimatedBlock: bigint | null; error: string | null } {
  const targetSec = BigInt(Math.floor(targetTimeMs / 1000));
  const latestSec = latestBlockTimestamp;
  let delta = targetSec - latestSec;
  if (delta <= 0n) {
    delta = BigInt(RELAY_BLOCK_TIME_SECONDS);
  }
  const bt = BigInt(RELAY_BLOCK_TIME_SECONDS);
  const blocksAhead = (delta + bt - 1n) / bt;
  let estimated = currentBlock + blocksAhead;
  if (estimated <= currentBlock) {
    estimated = currentBlock + 1n;
  }

  // Must be strictly greater than `block.number` at tx time — match `test-forwardmarket-individual.ts`
  // (`deliveryBlock = currentBlock + 10_000`) when the time-based number is too low for this RPC.
  const minFromHead = currentBlock + MIN_EVM_BLOCK_LEAD;
  if (estimated < minFromHead) {
    estimated = minFromHead;
  }

  if (estimated > RELAY_BLOCK_UINT32_MAX) {
    return {
      estimatedBlock: null,
      error:
        "That time is too far in the future for on-chain block fields (uint32). Choose an earlier date.",
    };
  }
  return { estimatedBlock: estimated, error: null };
}

/**
 * Right before `createAsk` / `writeCall`: re-read `block.number` from the RPC.
 * UI estimates use a cached head; by the time the wallet signs, `deliveryBlock <= block.number`
 * can still hold (same tiny gas revert). This matches scripts that read head and send immediately.
 */
export async function finalizeEvmFutureBlockForTx(
  publicClient: Pick<PublicClient, "getBlockNumber">,
  uiEstimatedBlock: bigint
): Promise<{ block: bigint; error: string | null; adjusted: boolean }> {
  const head = await publicClient.getBlockNumber();
  const floor = head + MIN_EVM_BLOCK_LEAD;
  let b = uiEstimatedBlock > floor ? uiEstimatedBlock : floor;
  if (b <= head) {
    b = head + 1n;
  }
  if (b > RELAY_BLOCK_UINT32_MAX) {
    return {
      block: 0n,
      error:
        "That delivery time maps to a block above uint32 max. Choose an earlier date.",
      adjusted: false,
    };
  }
  const adjusted = b !== uiEstimatedBlock;
  return { block: b, error: null, adjusted };
}
