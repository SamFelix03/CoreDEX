"use client";
import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useWriteCall, useWritePut } from "@/hooks/useOptions";
import { parseDOT } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function WriteOptionForm() {
  const [optionType, setOptionType] = useState<"call" | "put">("call");
  const [regionId, setRegionId] = useState("");
  const [strikePrice, setStrikePrice] = useState("");
  const [expiryBlock, setExpiryBlock] = useState("");

  const { writeCall, isPending: callPending, isSuccess: callSuccess, error: callError, reset: resetCall } = useWriteCall();
  const { writePut, isPending: putPending, isSuccess: putSuccess, error: putError, reset: resetPut } = useWritePut();

  const isPending = optionType === "call" ? callPending : putPending;
  const isSuccess = optionType === "call" ? callSuccess : putSuccess;
  const error = optionType === "call" ? callError : putError;

  const handleSubmit = async () => {
    if (!regionId || !strikePrice || !expiryBlock) return;
    try {
      if (optionType === "call") {
        await writeCall(BigInt(regionId), parseDOT(strikePrice), BigInt(expiryBlock));
      } else {
        await writePut(BigInt(regionId), parseDOT(strikePrice), BigInt(expiryBlock));
      }
    } catch (e) {
      console.error("writeOption failed:", e);
    }
  };

  const reset = () => {
    resetCall();
    resetPut();
  };

  return (
    <Card className="animate-slide-in-up">
      <CardHeader label="Write Option" />
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2">
          {(["call", "put"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setOptionType(t); reset(); }}
              className={cn(
                "flex-1 rounded-lg border py-2.5 text-xs font-medium uppercase tracking-wider transition-all",
                optionType === t
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <Input label="Region ID" type="number" placeholder="e.g. 42" value={regionId} onChange={(e) => { reset(); setRegionId(e.target.value); }} />
        <Input label="Strike Price" suffix="DOT" type="number" placeholder="e.g. 10.5" value={strikePrice} onChange={(e) => { reset(); setStrikePrice(e.target.value); }} />
        <Input label="Expiry Block" type="number" placeholder="e.g. 1000000" value={expiryBlock} onChange={(e) => { reset(); setExpiryBlock(e.target.value); }} />
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive animate-slide-in-up">
            {(error as Error).message?.slice(0, 120)}
          </div>
        )}
        {isSuccess && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-xs text-green-400 animate-slide-in-up">
            Option written successfully!
          </div>
        )}
        <Button
          onClick={handleSubmit}
          loading={isPending}
          disabled={!regionId || !strikePrice || !expiryBlock}
          className="w-full"
        >
          Write {optionType}
        </Button>
      </CardContent>
    </Card>
  );
}
