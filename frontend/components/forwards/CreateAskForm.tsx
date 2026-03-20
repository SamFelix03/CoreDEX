"use client";
import { useMemo, useState } from "react";
import { addHours, format } from "date-fns";
import { useChainId, usePublicClient } from "wagmi";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FutureRelayTimeInput } from "@/components/ui/FutureRelayTimeInput";
import { useCreateAsk } from "@/hooks/useForwardOrders";
import { useEstimatedRelayBlock } from "@/hooks/useEstimatedRelayBlock";
import { ASSET_HUB_CHAIN_ID, UI_STRIKE_MAX_WEI, UI_STRIKE_MIN_WEI } from "@/constants";
import { finalizeEvmFutureBlockForTx } from "@/lib/relayBlockEstimate";
import { formatTransactionError } from "@/lib/walletError";
import { TxSuccessWithExplorer } from "@/components/ui/TxSuccessWithExplorer";
import { formatDOT, parseDOT } from "@/lib/utils";

export function CreateAskForm() {
  const [regionId, setRegionId] = useState("");
  const [strikePrice, setStrikePrice] = useState("");
  const [deliveryWhen, setDeliveryWhen] = useState(() =>
    format(addHours(new Date(), 24), "yyyy-MM-dd'T'HH:mm")
  );

  const targetMs = useMemo(() => {
    if (!deliveryWhen?.trim()) return null;
    const t = new Date(deliveryWhen).getTime();
    return Number.isFinite(t) ? t : null;
  }, [deliveryWhen]);

  const {
    estimatedBlock: deliveryBlock,
    error: blockEstError,
    isLoadingHead,
    latestBlockNumber,
  } = useEstimatedRelayBlock(targetMs);

  const { createAsk, isPending, isSuccess, error, reset, hash } = useCreateAsk();
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
    deliveryBlock !== null &&
    !blockEstError &&
    !isLoadingHead;

  const handleSubmit = async () => {
    if (!canSubmit || deliveryBlock === null) return;
    if (!publicClient) {
      console.error("createAsk: no public client");
      return;
    }
    setBlockFinalizeNote(null);
    try {
      const { block, error: finErr, adjusted } = await finalizeEvmFutureBlockForTx(
        publicClient,
        deliveryBlock
      );
      if (finErr) {
        setBlockFinalizeNote(finErr);
        return;
      }
      if (adjusted) {
        setBlockFinalizeNote(
          `Using delivery block ${block.toString()} (fresh RPC head + minimum lead — avoids DeliveryBlockInPast).`
        );
      }
      await createAsk(BigInt(regionId), parseDOT(strikePrice), block);
    } catch (e) {
      console.error("createAsk failed:", e);
    }
  };

  return (
    <Card className="animate-slide-in-up">
      <CardHeader label="Create Forward Ask" />
      <CardContent className="flex flex-col gap-4">
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
          Coretime NFT token id you own; must not already be locked (open forward, option, or vault).
        </p>
        {wrongChain && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Switch your wallet to <span className="font-mono">Polkadot Hub TestNet</span> (chain{" "}
            {ASSET_HUB_CHAIN_ID}).
          </div>
        )}
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
          label="Delivery time"
          description="When this forward should settle (your local time). The app converts this to a relay block for the contract."
          value={deliveryWhen}
          onChange={(v) => {
            reset();
            setDeliveryWhen(v);
          }}
          estimatedBlock={deliveryBlock}
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
          <TxSuccessWithExplorer hash={hash}>
            <span>Forward ask created successfully.</span>
          </TxSuccessWithExplorer>
        )}
        <Button
          onClick={handleSubmit}
          loading={isPending}
          disabled={!canSubmit || wrongChain}
          className="w-full"
        >
          Create Ask
        </Button>
      </CardContent>
    </Card>
  );
}
