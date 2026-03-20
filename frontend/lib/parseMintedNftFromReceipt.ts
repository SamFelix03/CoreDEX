import { decodeEventLog, zeroAddress } from "viem";
import type { Hash, TransactionReceipt } from "viem";

/** Minimal ERC-721 `Transfer` for decoding mint logs. */
const ERC721_TRANSFER_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

/**
 * Reads the minted token id from an ERC-721 `Transfer` log (from == zero) on `contractAddress`.
 */
export function parseMintedErc721TokenIdFromReceipt(
  receipt: TransactionReceipt,
  contractAddress: Hash,
  mintedTo?: Hash
): bigint | undefined {
  const ca = contractAddress.toLowerCase();
  const toWant = mintedTo?.toLowerCase();

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ca) continue;
    try {
      const decoded = decodeEventLog({
        abi: ERC721_TRANSFER_ABI,
        data: log.data,
        topics: log.topics as [Hash, ...Hash[]],
      });
      if (decoded.eventName !== "Transfer") continue;
      const { from, to, tokenId } = decoded.args as {
        from: Hash;
        to: Hash;
        tokenId: bigint;
      };
      if (from.toLowerCase() !== zeroAddress.toLowerCase()) continue;
      if (toWant && to.toLowerCase() !== toWant) continue;
      return tokenId;
    } catch {
      continue;
    }
  }
  return undefined;
}
