"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useChainId } from "wagmi";
import { Button } from "@/components/ui/Button";
import { ASSET_HUB_CHAIN_ID } from "@/constants";
import { useMintCoretimeRegion } from "@/hooks/useMintCoretimeRegion";
import { getCoretimeNftScanMaxId } from "@/lib/coretimeNft";

export function CoretimeMintBanner() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const wrongChain = chainId !== ASSET_HUB_CHAIN_ID;
  const queryClient = useQueryClient();
  const { mint, isPending, isSuccess, error, reset } = useMintCoretimeRegion();

  const handleMint = async () => {
    reset();
    try {
      await mint();
      await queryClient.invalidateQueries({ queryKey: ["coretimeNft"] });
    } catch (e) {
      console.error("mintRegion failed:", e);
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 text-sm space-y-3">
      <div>
        <h2 className="font-semibold text-foreground">Mint your Coretime NFT</h2>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          One click — mints a demo region to your wallet (Hub TestNet mock). Then pick it in the region
          selector. Scan covers ids 1–{getCoretimeNftScanMaxId()}.
        </p>
      </div>
      {wrongChain && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Switch to <span className="font-mono">Polkadot Hub TestNet</span> (chain {ASSET_HUB_CHAIN_ID}) to mint.
        </div>
      )}
      {!isConnected && (
        <p className="text-xs text-amber-200/90">Connect your wallet to mint.</p>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {(error as Error).message?.slice(0, 200)}
        </div>
      )}
      {isSuccess && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-400">
          Mint confirmed — open the region picker to choose your new NFT.
        </div>
      )}
      <Button
        type="button"
        onClick={handleMint}
        loading={isPending}
        disabled={!isConnected || wrongChain}
        className="w-full sm:w-auto"
      >
        Mint Coretime NFT
      </Button>
    </div>
  );
}
