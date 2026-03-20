"use client";
import { useMemo, useState } from "react";
import { addHours, format } from "date-fns";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FutureRelayTimeInput } from "@/components/ui/FutureRelayTimeInput";
import { useCreateAsk } from "@/hooks/useForwardOrders";
import { useEstimatedRelayBlock } from "@/hooks/useEstimatedRelayBlock";
import { parseDOT } from "@/lib/utils";

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
        <Input
          label="Region ID"
          type="number"
          placeholder="e.g. 42"
          value={regionId}
          onChange={(e) => {
            reset();
            setRegionId(e.target.value);
          }}
        />
        <Input
          label="Strike Price"
          suffix="DOT"
          type="number"
          placeholder="e.g. 10.5"
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
          disabled={!canSubmit}
          className="w-full"
        >
          Create Ask
        </Button>
      </CardContent>
    </Card>
  );
}
