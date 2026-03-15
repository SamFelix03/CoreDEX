"use client";
import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useVaultDeposit } from "@/hooks/useVault";

export function DepositForm() {
  const [regionId, setRegionId] = useState("");
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
        <Input
          label="Region ID"
          type="number"
          placeholder="Coretime Region NFT ID"
          value={regionId}
          onChange={(e) => { reset(); setRegionId(e.target.value); }}
        />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Deposit your Coretime NFT into the vault to earn yield from lending fees.
          You will receive a receipt token that can be used to withdraw later.
        </p>
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
        <Button onClick={handleDeposit} loading={isPending} disabled={!regionId} className="w-full">
          Deposit
        </Button>
      </CardContent>
    </Card>
  );
}
