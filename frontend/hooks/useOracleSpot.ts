"use client";

import { useReadContract } from "wagmi";
import { coretimeOracleContract } from "@/lib/contracts";
import { ASSET_HUB_CHAIN_ID, PRICE_BAND_PCT } from "@/constants";

/**
 * Oracle spot + allowed strike range (±PRICE_BAND_PCT), matching on-chain `_validateStrikePrice`.
 */
export function useOracleSpot() {
  const { data: spot, isLoading, error } = useReadContract({
    ...coretimeOracleContract,
    functionName: "spotPrice",
    chainId: ASSET_HUB_CHAIN_ID,
    query: { refetchInterval: 60_000 },
  });

  const spotBi = spot as bigint | undefined;
  const low =
    spotBi !== undefined ? (spotBi * (100n - PRICE_BAND_PCT)) / 100n : undefined;
  const high =
    spotBi !== undefined ? (spotBi * (100n + PRICE_BAND_PCT)) / 100n : undefined;
  /** Same as Hardhat test scripts: 120% of spot. */
  const suggestedStrike =
    spotBi !== undefined ? (spotBi * 120n) / 100n : undefined;

  return {
    spot: spotBi,
    strikeMin: low,
    strikeMax: high,
    suggestedStrike,
    isLoading,
    error,
  };
}
