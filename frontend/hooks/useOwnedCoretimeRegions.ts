"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { ASSET_HUB_CHAIN_ID } from "@/constants";
import {
  CORETIME_NFT_ABI,
  coretimeNftContract,
  getCoretimeNftScanMaxId,
} from "@/lib/coretimeNft";

export type OwnedCoretimeRegion = {
  id: bigint;
  begin: number;
  end: number;
};

const OWNER_BATCH = 96;

function toNum(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  return Number(v);
}

/**
 * Lists Coretime NFTs owned by the connected wallet by scanning token ids 1..max
 * (PVM mock has no ERC721Enumerable). Increase NEXT_PUBLIC_CORETIME_NFT_SCAN_MAX_ID if you mint past the default.
 */
export function useOwnedCoretimeRegions() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: ASSET_HUB_CHAIN_ID });
  const maxScan = getCoretimeNftScanMaxId();

  return useQuery({
    queryKey: ["coretimeNft", "owned", address, maxScan, ASSET_HUB_CHAIN_ID],
    enabled: !!address && !!publicClient,
    staleTime: 25_000,
    queryFn: async (): Promise<OwnedCoretimeRegion[]> => {
      if (!address || !publicClient) return [];
      const addrLc = address.toLowerCase();
      const ownedIds: bigint[] = [];

      for (let start = 1; start <= maxScan; start += OWNER_BATCH) {
        const end = Math.min(start + OWNER_BATCH - 1, maxScan);
        const contracts = [];
        for (let id = start; id <= end; id++) {
          contracts.push({
            address: coretimeNftContract.address,
            abi: CORETIME_NFT_ABI,
            functionName: "ownerOf" as const,
            args: [BigInt(id)] as const,
          });
        }

        const results = await publicClient.multicall({
          contracts,
          allowFailure: true,
        });

        let offset = 0;
        for (let id = start; id <= end; id++, offset++) {
          const r = results[offset];
          if (r.status !== "success" || r.result === undefined) continue;
          const owner = r.result as string;
          if (owner.toLowerCase() === addrLc) {
            ownedIds.push(BigInt(id));
          }
        }
      }

      if (ownedIds.length === 0) return [];

      const metaContracts = ownedIds.flatMap((id) => [
        {
          address: coretimeNftContract.address,
          abi: CORETIME_NFT_ABI,
          functionName: "regionBegin" as const,
          args: [id] as const,
        },
        {
          address: coretimeNftContract.address,
          abi: CORETIME_NFT_ABI,
          functionName: "regionEnd" as const,
          args: [id] as const,
        },
      ]);

      const metaResults = await publicClient.multicall({
        contracts: metaContracts,
        allowFailure: true,
      });

      const out: OwnedCoretimeRegion[] = [];
      for (let i = 0; i < ownedIds.length; i++) {
        const b = metaResults[i * 2];
        const e = metaResults[i * 2 + 1];
        const begin = b.status === "success" && b.result !== undefined ? toNum(b.result) : 0;
        const end = e.status === "success" && e.result !== undefined ? toNum(e.result) : 0;
        out.push({ id: ownedIds[i], begin, end });
      }

      out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      return out;
    },
  });
}
