"use client";
import { useMemo, useState } from "react";
import { addHours, format } from "date-fns";
import { useChainId } from "wagmi";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RegionSelectorField } from "@/components/coretime/RegionSelectorField";
import { FutureRelayTimeInput } from "@/components/ui/FutureRelayTimeInput";
import { useCreateAsk } from "@/hooks/useForwardOrders";
import { useEstimatedRelayBlock } from "@/hooks/useEstimatedRelayBlock";
import { useOracleSpot } from "@/hooks/useOracleSpot";
import { ASSET_HUB_CHAIN_ID, PRICE_BAND_PCT } from "@/constants";
import { dotWeiToInputString, formatDOT, parseDOT } from "@/lib/utils";

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

  const { createAsk, isPending, isSuccess, error, reset } = useCreateAsk();
  const chainId = useChainId();
  const { spot, strikeMin, strikeMax, suggestedStrike, isLoading: spotLoading } = useOracleSpot();
  const wrongChain = chainId !== ASSET_HUB_CHAIN_ID;

  const canSubmit =
    !!regionId &&
    !!strikePrice &&
    deliveryBlock !== null &&
    !blockEstError &&
    !isLoadingHead;

  const handleSubmit = async () => {
    if (!canSubmit || deliveryBlock === null) return;
    try {
      await createAsk(BigInt(regionId), parseDOT(strikePrice), deliveryBlock);
    } catch (e) {
      console.error("createAsk failed:", e);
    }
  };

  return (
    <Card className="animate-slide-in-up">
      <CardHeader label="Create Forward Ask" />
      <CardContent className="flex flex-col gap-4">
        <RegionSelectorField
          label="Coretime region"
          value={regionId}
          onChange={(v) => {
            reset();
            setRegionId(v);
          }}
          disabled={wrongChain}
          helperText="Choose an NFT you own. It must not already be locked (open forward, option, or vault)."
        />
        {wrongChain && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Switch your wallet to <span className="font-mono">Polkadot Hub TestNet</span> (chain{" "}
            {ASSET_HUB_CHAIN_ID}). The test script uses the same network.
          </div>
        )}
        {!spotLoading && spot !== undefined && strikeMin !== undefined && strikeMax !== undefined && (
          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
            <div>
              Oracle spot: <span className="text-foreground font-mono">{formatDOT(spot)} DOT</span>
            </div>
            <div>
              Allowed strike (±{String(PRICE_BAND_PCT)}%):{" "}
              <span className="text-foreground font-mono">
                {formatDOT(strikeMin)} – {formatDOT(strikeMax)} DOT
              </span>
            </div>
            <p className="text-[10px] text-white/50 pt-1">
              The old placeholder &quot;10.5&quot; is <strong>outside</strong> this band — the contract reverts
              (same as the test using <strong>6</strong> DOT at ~5 spot).
            </p>
            {suggestedStrike !== undefined && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-8 text-[10px]"
                onClick={() => {
                  reset();
                  setStrikePrice(dotWeiToInputString(suggestedStrike));
                }}
              >
                Use test-script strike (+20% spot → {formatDOT(suggestedStrike)} DOT)
              </Button>
            )}
          </div>
        )}
        <Input
          label="Strike Price"
          suffix="DOT"
          type="number"
          placeholder="e.g. 6"
          value={strikePrice}
          onChange={(e) => {
            reset();
            setStrikePrice(e.target.value);
          }}
        />
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
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive animate-slide-in-up">
            {(error as Error).message?.slice(0, 120)}
          </div>
        )}
        {isSuccess && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-xs text-green-400 animate-slide-in-up">
            Forward ask created successfully!
          </div>
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
