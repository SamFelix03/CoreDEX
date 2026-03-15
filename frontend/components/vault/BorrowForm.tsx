"use client";
import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useVaultBorrow } from "@/hooks/useVault";

export function BorrowForm() {
  const [coreCount, setCoreCount] = useState("");
  const [durationBlocks, setDurationBlocks] = useState("");
  const { borrow, isPending, isSuccess, error, reset } = useVaultBorrow();

  const handleBorrow = async () => {
    if (!coreCount || !durationBlocks) return;
    try {
      await borrow(BigInt(coreCount), BigInt(durationBlocks));
    } catch (e) {
      console.error("borrow failed:", e);
    }
  };

  return (
    <Card className="animate-slide-in-up">
      <CardHeader label="Borrow Regions" />
      <CardContent className="flex flex-col gap-4">
        <Input
          label="Core Count"
          type="number"
          placeholder="Number of cores to borrow"
          value={coreCount}
          onChange={(e) => { reset(); setCoreCount(e.target.value); }}
        />
        <Input
          label="Duration (blocks)"
          type="number"
          placeholder="e.g. 50400 (~7 days)"
          value={durationBlocks}
          onChange={(e) => { reset(); setDurationBlocks(e.target.value); }}
        />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Borrow Coretime regions from the vault by paying a lending fee.
          Regions must be returned before the due block.
        </p>
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive animate-slide-in-up">
            {(error as Error).message?.slice(0, 120)}
          </div>
        )}
        {isSuccess && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-xs text-green-400 animate-slide-in-up">
            Borrow successful!
          </div>
        )}
        <Button
          variant="outline"
          onClick={handleBorrow}
          loading={isPending}
          disabled={!coreCount || !durationBlocks}
          className="w-full"
        >
          Borrow
        </Button>
      </CardContent>
    </Card>
  );
}
