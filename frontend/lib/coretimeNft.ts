import { CORETIME_NFT_PRECOMPILE } from "@/constants";

/** PVM Coretime NFT mock — mint only (no on-chain enumeration in UI). */
export const CORETIME_NFT_ABI = [
  {
    name: "mintRegion",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "regionBegin", type: "uint32" },
      { name: "regionEnd", type: "uint32" },
      { name: "cores", type: "uint16" },
    ],
    outputs: [{ name: "tokenId", type: "uint128" }],
  },
] as const;

export const coretimeNftContract = {
  address: CORETIME_NFT_PRECOMPILE,
  abi: CORETIME_NFT_ABI,
} as const;
