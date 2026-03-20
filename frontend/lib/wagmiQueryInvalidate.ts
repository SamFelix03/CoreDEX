import type { QueryClient } from "@tanstack/react-query";

function queryKeyMentionsReadContract(key: readonly unknown[]): boolean {
  const walk = (v: unknown): boolean => {
    if (v === "readContract" || v === "readContracts") return true;
    if (Array.isArray(v)) return v.some(walk);
    if (v && typeof v === "object") return Object.values(v as object).some(walk);
    return false;
  };
  return walk(key);
}

/**
 * After a tx is mined, force wagmi `useReadContract` / `useReadContracts` to refetch so list UIs
 * update immediately (global `refetchInterval` alone can leave stale data for many seconds).
 *
 * Uses a predicate because wagmi v2 query keys are nested and not always `["readContract", …]`.
 */
export function invalidateProtocolContractReads(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (q) => queryKeyMentionsReadContract(q.queryKey as readonly unknown[]),
  });
}
