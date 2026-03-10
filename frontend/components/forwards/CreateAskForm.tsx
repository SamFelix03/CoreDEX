"use client";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
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
    <Card>
      <CardHeader label="Create Forward Ask" />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
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
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--red)", padding: "8px 12px", background: "rgba(255,68,68,0.1)", borderRadius: 3 }}>
            {(error as Error).message?.slice(0, 120)}
          </div>
        )}

        {isSuccess && (
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--green)", padding: "8px 12px", background: "rgba(0,255,136,0.1)", borderRadius: 3 }}>
            Forward ask created successfully!
          </div>
        )}

        <Button
          onClick={handleSubmit}
          loading={isPending}
          disabled={!regionId || !strikePrice || !deliveryBlock}
        >
          Create Ask
        </Button>
      </div>
    </Card>
  );
}
