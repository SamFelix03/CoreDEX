"use client";
import { useState } from "react";
import { useChainId } from "wagmi";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RegionSelectorField } from "@/components/coretime/RegionSelectorField";
import { useVaultDeposit } from "@/hooks/useVault";
import { ASSET_HUB_CHAIN_ID } from "@/constants";

export function DepositForm() {
  const [regionId, setRegionId] = useState("");
  const chainId = useChainId();
  const wrongChain = chainId !== ASSET_HUB_CHAIN_ID;
  const { deposit, isPending, isSuccess, error, reset } = useVaultDeposit();

  const handleDeposit = async () => {
    if (!regionId) return;
    try {
      await deposit(BigInt(regionId));
    } catch (e) {
      console.error("deposit failed:", e);
    }
  };

  return (
    <Card className="animate-slide-in-up">
      <CardHeader label="Deposit Region" />
      <CardContent className="flex flex-col gap-4">
        {wrongChain && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Switch to <span className="font-mono">Polkadot Hub TestNet</span> (chain {ASSET_HUB_CHAIN_ID}).
          </div>
        )}
        <RegionSelectorField
          label="Coretime region"
          value={regionId}
          onChange={(v) => {
            reset();
            setRegionId(v);
          }}
          disabled={wrongChain}
          helperText="Deposit your Coretime NFT into the vault. You receive a receipt for yield and later withdrawal."
        />
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive animate-slide-in-up">
            {(error as Error).message?.slice(0, 120)}
          </div>
        )}
        {isSuccess && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-xs text-green-400 animate-slide-in-up">
            Region deposited successfully!
          </div>
        )}
        <Button
          onClick={handleDeposit}
          loading={isPending}
          disabled={!regionId || wrongChain}
          className="w-full"
        >
          Deposit
        </Button>
      </CardContent>
    </Card>
  );
}
