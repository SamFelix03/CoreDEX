"use client";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useVaultDeposit } from "@/hooks/useVault";

export function DepositForm() {
  const [regionId, setRegionId] = useState("");
  const { deposit, isPending, isSuccess, error, reset } = useVaultDeposit();

  const handleDeposit = async () => {
    if (!regionId) return;
    try {
      await deposit(BigInt(regionId));
    } catch (e) {
      console.error("deposit failed:", e);
    }
  };

  return (
    <Card>
      <CardHeader label="Deposit Region" />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <Input
          label="Region ID"
          type="number"
          placeholder="Coretime Region NFT ID"
          value={regionId}
          onChange={(e) => { reset(); setRegionId(e.target.value); }}
        />

        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--muted)", lineHeight: 1.6 }}>
          Deposit your Coretime NFT into the vault to earn yield from lending fees.
          You will receive a receipt token that can be used to withdraw later.
        </p>

        {error && (
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--red)", padding: "8px 12px", background: "rgba(255,68,68,0.1)", borderRadius: 3 }}>
            {(error as Error).message?.slice(0, 120)}
          </div>
        )}

        {isSuccess && (
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--green)", padding: "8px 12px", background: "rgba(0,255,136,0.1)", borderRadius: 3 }}>
            Region deposited successfully!
          </div>
        )}

        <Button onClick={handleDeposit} loading={isPending} disabled={!regionId}>
          Deposit
        </Button>
      </div>
    </Card>
  );
}
