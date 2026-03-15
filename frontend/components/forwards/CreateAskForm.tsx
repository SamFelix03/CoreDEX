"use client";
import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useCreateAsk } from "@/hooks/useForwardOrders";
import { parseDOT } from "@/lib/utils";

export function CreateAskForm() {
  const [regionId, setRegionId] = useState("");
  const [strikePrice, setStrikePrice] = useState("");
  const [deliveryBlock, setDeliveryBlock] = useState("");
  const { createAsk, isPending, isSuccess, error, reset } = useCreateAsk();

  const handleSubmit = async () => {
    if (!regionId || !strikePrice || !deliveryBlock) return;
    try {
      await createAsk(
        BigInt(regionId),
        parseDOT(strikePrice),
        BigInt(deliveryBlock)
      );
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
          onChange={(e) => { reset(); setRegionId(e.target.value); }}
        />
        <Input
          label="Strike Price"
          suffix="DOT"
          type="number"
          placeholder="e.g. 10.5"
          value={strikePrice}
          onChange={(e) => { reset(); setStrikePrice(e.target.value); }}
        />
        <Input
          label="Delivery Block"
          type="number"
          placeholder="e.g. 1000000"
          value={deliveryBlock}
          onChange={(e) => { reset(); setDeliveryBlock(e.target.value); }}
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
          disabled={!regionId || !strikePrice || !deliveryBlock}
          className="w-full"
        >
          Create Ask
        </Button>
      </CardContent>
    </Card>
  );
}
