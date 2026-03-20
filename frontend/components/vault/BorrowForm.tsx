"use client";
import { useMemo, useState } from "react";
import { addHours, format } from "date-fns";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FutureRelayTimeInput } from "@/components/ui/FutureRelayTimeInput";
import { useVaultBorrow } from "@/hooks/useVault";
import { useEstimatedRelayBlock } from "@/hooks/useEstimatedRelayBlock";
import { blocksToTime } from "@/lib/utils";

export function BorrowForm() {
  const [coreCount, setCoreCount] = useState("");
  const [returnWhen, setReturnWhen] = useState(() =>
    format(addHours(new Date(), 24 * 7), "yyyy-MM-dd'T'HH:mm")
  );

  const targetMs = useMemo(() => {
    if (!returnWhen?.trim()) return null;
    const t = new Date(returnWhen).getTime();
    return Number.isFinite(t) ? t : null;
  }, [returnWhen]);

  const {
    estimatedBlock: dueBlock,
    error: blockEstError,
    isLoadingHead,
    latestBlockNumber,
  } = useEstimatedRelayBlock(targetMs);

  const durationBlocks =
    dueBlock !== null && latestBlockNumber !== null && dueBlock > latestBlockNumber
      ? dueBlock - latestBlockNumber
      : null;

  const { borrow, isPending, isSuccess, error, reset } = useVaultBorrow();

  const canSubmit =
    !!coreCount &&
    durationBlocks !== null &&
    durationBlocks >= 1n &&
    !blockEstError &&
    !isLoadingHead;

  const handleBorrow = async () => {
    if (!canSubmit || durationBlocks === null) return;
    try {
      await borrow(BigInt(coreCount), durationBlocks);
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
          onChange={(e) => {
            reset();
            setCoreCount(e.target.value);
          }}
        />
        <FutureRelayTimeInput
          label="Return by"
          description="Loan duration is computed as blocks from the current head until this time (~12s per block)."
          value={returnWhen}
          onChange={(v) => {
            reset();
            setReturnWhen(v);
          }}
          estimatedBlock={dueBlock}
          estimateError={blockEstError}
          isLoadingHead={isLoadingHead}
          latestBlockNumber={latestBlockNumber}
          showEstimatedBlockLine={false}
        />
        {durationBlocks !== null && durationBlocks >= 1n && !blockEstError && (
          <p className="text-xs text-muted-foreground">
            Duration sent to contract:{" "}
            <span className="font-mono text-foreground">{durationBlocks.toString()}</span> blocks
            (~{blocksToTime(durationBlocks)})
          </p>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed">
          Borrow Coretime regions from the vault by paying a lending fee. Regions must be returned
          before the due block derived from your return-by time.
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
          disabled={!canSubmit}
          className="w-full"
        >
          Borrow
        </Button>
      </CardContent>
    </Card>
  );
}
