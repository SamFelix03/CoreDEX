import { useReadContracts } from "wagmi";
import { registryContract } from "@/lib/contracts";

export function useProtocolStatus() {
  const { data, isLoading, error } = useReadContracts({
    contracts: [
      { ...registryContract, functionName: "paused" },
      { ...registryContract, functionName: "governance" },
      { ...registryContract, functionName: "version" },
    ],
  });

  return {
    paused:     data?.[0]?.result as boolean | undefined,
    governance: data?.[1]?.result as string | undefined,
    version:    data?.[2]?.result as bigint | undefined,
    isLoading,
    error,
  };
}
