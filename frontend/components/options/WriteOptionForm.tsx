"use client";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useWriteCall, useWritePut } from "@/hooks/useOptions";
import { parseDOT } from "@/lib/utils";

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
    <Card>
      <CardHeader label="Write Option" />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Type toggle */}
        <div style={{ display: "flex", gap: 4 }}>
          {(["call", "put"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setOptionType(t); reset(); }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 3,
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 11,
                fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase",
                cursor: "pointer", transition: "all 0.15s",
                background: optionType === t ? (t === "call" ? "rgba(0,212,255,0.15)" : "rgba(230,0,122,0.15)") : "var(--surface2)",
                color: optionType === t ? (t === "call" ? "var(--cyan)" : "var(--pink)") : "var(--muted)",
                border: optionType === t ? `1px solid ${t === "call" ? "var(--cyan)" : "var(--pink)"}` : "1px solid var(--border)",
              }}
            >
              {t}
            </button>
          ))}
        </div>

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
          label="Expiry Block"
          type="number"
          placeholder="e.g. 1000000"
          value={expiryBlock}
          onChange={(e) => { reset(); setExpiryBlock(e.target.value); }}
        />

        {error && (
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--red)", padding: "8px 12px", background: "rgba(255,68,68,0.1)", borderRadius: 3 }}>
            {(error as Error).message?.slice(0, 120)}
          </div>
        )}

        {isSuccess && (
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--green)", padding: "8px 12px", background: "rgba(0,255,136,0.1)", borderRadius: 3 }}>
            Option written successfully!
          </div>
        )}

        <Button
          onClick={handleSubmit}
          loading={isPending}
          disabled={!regionId || !strikePrice || !expiryBlock}
          style={{ background: optionType === "call" ? "var(--cyan)" : "var(--pink)" }}
        >
          Write {optionType}
        </Button>
      </div>
    </Card>
  );
}
