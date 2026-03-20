"use client";

import { useAccount, useChainId } from "wagmi";
import { Button } from "@/components/ui/Button";
import { ASSET_HUB_CHAIN_ID } from "@/constants";
import { useMintCoretimeRegion } from "@/hooks/useMintCoretimeRegion";

export function CoretimeMintBanner() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const wrongChain = chainId !== ASSET_HUB_CHAIN_ID;
  const { mint, isPending, isSuccess, error, reset, mintedTokenId, hash } = useMintCoretimeRegion();

  const handleMint = async () => {
    reset();
    try {
      await mint();
    } catch (e) {
      console.error("mintRegion failed:", e);
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 text-sm space-y-3">
      <div>
        <h2 className="font-semibold text-foreground">Mint your Coretime NFT</h2>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Mints a demo region to your wallet. After the transaction confirms, the new region ID is shown below —
          enter it in the Region ID field on this page.
        </p>
      </div>
      {wrongChain && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Switch to <span className="font-mono">Polkadot Hub TestNet</span> (chain {ASSET_HUB_CHAIN_ID}) to mint.
        </div>
      )}
      {!isConnected && <p className="text-xs text-amber-200/90">Connect your wallet to mint.</p>}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {(error as Error).message?.slice(0, 200)}
        </div>
      )}
      {isSuccess && mintedTokenId !== undefined && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-400 space-y-1">
          <div>
            Mint confirmed — <span className="font-semibold">Region ID</span>{" "}
            <span className="font-mono text-sm text-white">{mintedTokenId.toString()}</span>
          </div>
          {hash && (
            <div className="text-[10px] text-green-400/80 font-mono break-all">Tx: {hash}</div>
          )}
        </div>
      )}
      {isSuccess && mintedTokenId === undefined && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 space-y-1">
          <p>
            Mint confirmed, but the region ID wasn&apos;t resolved (simulation may have failed earlier, or logs
            don&apos;t match ERC-721). Check the transaction in your wallet or explorer.
          </p>
          {hash && <p className="font-mono text-[10px] break-all opacity-90">{hash}</p>}
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
