import { CORETIME_NFT_PRECOMPILE } from "@/constants";

/** PVM Coretime NFT mock — subset of ABI used by the app. */
export const CORETIME_NFT_ABI = [
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "regionBegin",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint32" }],
  },
  {
    name: "regionEnd",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint32" }],
  },
] as const;

export const coretimeNftContract = {
  address: CORETIME_NFT_PRECOMPILE,
  abi:     CORETIME_NFT_ABI,
} as const;

/** Max token id to scan with ownerOf (mock mints sequential ids). */
export function getCoretimeNftScanMaxId(): number {
  const raw = process.env.NEXT_PUBLIC_CORETIME_NFT_SCAN_MAX_ID;
  const n = raw ? Number(raw) : 4096;
  if (!Number.isFinite(n) || n < 1) return 4096;
  return Math.min(Math.floor(n), 20_000);
}
