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

/** Parallel reads per batch (no Multicall3 — Polkadot Hub TestNet). */
const OWNER_READ_CONCURRENCY = 24;

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

      for (let start = 1; start <= maxScan; start += OWNER_READ_CONCURRENCY) {
        const end = Math.min(start + OWNER_READ_CONCURRENCY - 1, maxScan);
        const batch = await Promise.all(
          Array.from({ length: end - start + 1 }, (_, k) => {
            const id = BigInt(start + k);
            return publicClient
              .readContract({
                address: coretimeNftContract.address,
                abi: CORETIME_NFT_ABI,
                functionName: "ownerOf",
                args: [id],
              })
              .then((owner) => ({ id, owner: owner as string }))
              .catch(() => null);
          })
        );
        for (const r of batch) {
          if (r && r.owner.toLowerCase() === addrLc) {
            ownedIds.push(r.id);
          }
        }
      }

      if (ownedIds.length === 0) return [];

      const metaPairs = await Promise.all(
        ownedIds.flatMap((id) => [
          publicClient
            .readContract({
              address: coretimeNftContract.address,
              abi: CORETIME_NFT_ABI,
              functionName: "regionBegin",
              args: [id],
            })
            .then((v) => toNum(v))
            .catch(() => 0),
          publicClient
            .readContract({
              address: coretimeNftContract.address,
              abi: CORETIME_NFT_ABI,
              functionName: "regionEnd",
              args: [id],
            })
            .then((v) => toNum(v))
            .catch(() => 0),
        ])
      );

      const out: OwnedCoretimeRegion[] = [];
      for (let i = 0; i < ownedIds.length; i++) {
        out.push({
          id: ownedIds[i],
          begin: metaPairs[i * 2] ?? 0,
          end: metaPairs[i * 2 + 1] ?? 0,
        });
      }

      out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      return out;
    },
  });
}
