import { useReadContract, useReadContracts } from "wagmi";
import { ledgerContract } from "@/lib/contracts";

export function useLedgerStats(address?: `0x${string}`) {
  const { data: totalLockEvents, isLoading: lockLoading } = useReadContract({
    ...ledgerContract,
    functionName: "totalLockEvents",
  });

  const { data: marginBalance, isLoading: marginLoading } = useReadContract({
    ...ledgerContract,
    functionName: "marginBalance",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: openPositionCount, isLoading: posLoading } = useReadContract({
    ...ledgerContract,
    functionName: "openPositionCount",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return {
    totalLockEvents:   (totalLockEvents as bigint) ?? 0n,
    marginBalance:     (marginBalance as bigint) ?? 0n,
    openPositionCount: Number(openPositionCount ?? 0),
    isLoading:         lockLoading || marginLoading || posLoading,
  };
}

export function useRegionLock(regionId: bigint | undefined) {
  const { data: isLocked } = useReadContract({
    ...ledgerContract,
    functionName: "isRegionLocked",
    args: regionId !== undefined ? [regionId] : undefined,
    query: { enabled: regionId !== undefined },
  });

  const { data: locker } = useReadContract({
    ...ledgerContract,
    functionName: "getRegionLocker",
    args: regionId !== undefined ? [regionId] : undefined,
    query: { enabled: regionId !== undefined },
  });

  return {
    isLocked: isLocked as boolean | undefined,
    locker:   locker as string | undefined,
  };
}
