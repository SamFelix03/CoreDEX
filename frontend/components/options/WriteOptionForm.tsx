"use client";
import { useMemo, useState } from "react";
import { addHours, format } from "date-fns";
import { useChainId, usePublicClient } from "wagmi";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FutureRelayTimeInput } from "@/components/ui/FutureRelayTimeInput";
import { useWriteCall, useWritePut } from "@/hooks/useOptions";
import { useEstimatedRelayBlock } from "@/hooks/useEstimatedRelayBlock";
import { ASSET_HUB_CHAIN_ID, UI_STRIKE_MAX_WEI, UI_STRIKE_MIN_WEI } from "@/constants";
import { finalizeEvmFutureBlockForTx } from "@/lib/relayBlockEstimate";
import { formatTransactionError } from "@/lib/walletError";
import { TxSuccessWithExplorer } from "@/components/ui/TxSuccessWithExplorer";
import { formatDOT, parseDOT, cn } from "@/lib/utils";

export function WriteOptionForm() {
  const [optionType, setOptionType] = useState<"call" | "put">("call");
  const [regionId, setRegionId] = useState("");
  const [strikePrice, setStrikePrice] = useState("");
  const [expiryWhen, setExpiryWhen] = useState(() =>
    format(addHours(new Date(), 24), "yyyy-MM-dd'T'HH:mm")
  );

  const targetMs = useMemo(() => {
    if (!expiryWhen?.trim()) return null;
    const t = new Date(expiryWhen).getTime();
    return Number.isFinite(t) ? t : null;
  }, [expiryWhen]);

  const {
    estimatedBlock: expiryBlock,
    error: blockEstError,
    isLoadingHead,
    latestBlockNumber,
  } = useEstimatedRelayBlock(targetMs);

  const {
    writeCall,
    isPending: callPending,
    isSuccess: callSuccess,
    error: callError,
    reset: resetCall,
    hash: callHash,
  } = useWriteCall();
  const {
    writePut,
    isPending: putPending,
    isSuccess: putSuccess,
    error: putError,
    reset: resetPut,
    hash: putHash,
  } = useWritePut();

  const isPending = optionType === "call" ? callPending : putPending;
  const isSuccess = optionType === "call" ? callSuccess : putSuccess;
  const successHash = optionType === "call" ? callHash : putHash;
  const error = optionType === "call" ? callError : putError;

  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: ASSET_HUB_CHAIN_ID });
  const wrongChain = chainId !== ASSET_HUB_CHAIN_ID;
  const [blockFinalizeNote, setBlockFinalizeNote] = useState<string | null>(null);

  const strikeWei = parseDOT(strikePrice.trim());
  const strikeInRange =
    strikeWei > 0n && strikeWei >= UI_STRIKE_MIN_WEI && strikeWei <= UI_STRIKE_MAX_WEI;

  const canSubmit =
    !!regionId &&
    strikeInRange &&
    expiryBlock !== null &&
    !blockEstError &&
    !isLoadingHead;

  const handleSubmit = async () => {
    if (!canSubmit || expiryBlock === null) return;
    if (!publicClient) {
      console.error("writeOption: no public client");
      return;
    }
    setBlockFinalizeNote(null);
    try {
      const { block, error: finErr, adjusted } = await finalizeEvmFutureBlockForTx(
        publicClient,
        expiryBlock
      );
      if (finErr) {
        setBlockFinalizeNote(finErr);
        return;
      }
      if (adjusted) {
        setBlockFinalizeNote(
          `Using expiry block ${block.toString()} (fresh RPC head + minimum lead — avoids DeliveryBlockInPast).`
        );
      }
      if (optionType === "call") {
        await writeCall(BigInt(regionId), parseDOT(strikePrice), block);
      } else {
        await writePut(BigInt(regionId), parseDOT(strikePrice), block);
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
              onClick={() => {
                setOptionType(t);
                reset();
              }}
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
        {wrongChain && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Switch your wallet to <span className="font-mono">Polkadot Hub TestNet</span> (chain{" "}
            {ASSET_HUB_CHAIN_ID}).
          </div>
        )}
        <Input
          label="Region ID"
          type="number"
          placeholder="e.g. 42"
          value={regionId}
          onChange={(e) => {
            reset();
            setRegionId(e.target.value);
          }}
          disabled={wrongChain}
        />
        <p className="text-[10px] text-muted-foreground -mt-2">
          For calls, use a Coretime NFT you own that is not locked elsewhere.
        </p>
        <Input
          label="Strike Price"
          suffix="DOT"
          type="number"
          min={2.5}
          max={7.5}
          step={0.01}
          placeholder="2.5 – 7.5"
          value={strikePrice}
          onChange={(e) => {
            reset();
            setStrikePrice(e.target.value);
          }}
        />
        <p className="text-[10px] text-muted-foreground -mt-2">
          Enter between <span className="font-mono text-foreground">{formatDOT(UI_STRIKE_MIN_WEI)}</span> and{" "}
          <span className="font-mono text-foreground">{formatDOT(UI_STRIKE_MAX_WEI)}</span> DOT (contract still
          validates against the oracle spot ±50%).
        </p>
        {strikePrice.trim() !== "" && !strikeInRange && (
          <p className="text-[10px] text-destructive">
            Strike must be between {formatDOT(UI_STRIKE_MIN_WEI)} and {formatDOT(UI_STRIKE_MAX_WEI)} DOT.
          </p>
        )}
        <FutureRelayTimeInput
          label="Expiry time"
          description="When this option expires (European exercise). Converted to a relay block on submit."
          value={expiryWhen}
          onChange={(v) => {
            reset();
            setExpiryWhen(v);
          }}
          estimatedBlock={expiryBlock}
          estimateError={blockEstError}
          isLoadingHead={isLoadingHead}
          latestBlockNumber={latestBlockNumber}
        />
        {blockFinalizeNote && (
          <div
            className={`rounded-lg border px-4 py-3 text-xs animate-slide-in-up ${
              blockFinalizeNote.includes("fresh RPC head")
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {blockFinalizeNote}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive animate-slide-in-up whitespace-pre-wrap break-words">
            {formatTransactionError(error)}
          </div>
        )}
        {isSuccess && (
          <TxSuccessWithExplorer hash={successHash}>
            <span>Option written successfully.</span>
          </TxSuccessWithExplorer>
        )}
        <Button
          onClick={handleSubmit}
          loading={isPending}
          disabled={!canSubmit || wrongChain}
          className="w-full"
        >
          Write {optionType}
        </Button>
      </CardContent>
    </Card>
  );
}
