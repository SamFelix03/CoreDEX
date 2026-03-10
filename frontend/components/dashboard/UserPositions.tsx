"use client";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAccount } from "wagmi";
import { useForwardOrders } from "@/hooks/useForwardOrders";
import { useOptionsData } from "@/hooks/useOptions";
import { useVaultDeposits } from "@/hooks/useVault";
import Link from "next/link";

export function UserPositions() {
  const { address } = useAccount();
  const { sellerOrderIds, buyerOrderIds } = useForwardOrders(address);
  const { writerOptionIds, holderOptionIds } = useOptionsData(address);
  const { receiptIds } = useVaultDeposits(address);

  if (!address) {
    return (
      <Card>
        <CardHeader label="Your Positions" />
        <div style={{ padding: 24, textAlign: "center" }}>
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "var(--muted)" }}>
            Connect your wallet to view positions
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader label="Your Positions" />
      <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {/* Forwards */}
        <Link href="/forwards" style={{ textDecoration: "none" }}>
          <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 3, padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Forwards
              </span>
              <Badge label="Sell/Buy" color="var(--cyan)" />
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 22, color: "var(--text)" }}>
              {(sellerOrderIds?.length ?? 0) + (buyerOrderIds?.length ?? 0)}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
              {sellerOrderIds?.length ?? 0} selling · {buyerOrderIds?.length ?? 0} buying
            </div>
          </div>
        </Link>

        {/* Options */}
        <Link href="/options" style={{ textDecoration: "none" }}>
          <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 3, padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Options
              </span>
              <Badge label="Write/Hold" color="var(--pink)" />
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 22, color: "var(--text)" }}>
              {(writerOptionIds?.length ?? 0) + (holderOptionIds?.length ?? 0)}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
              {writerOptionIds?.length ?? 0} written · {holderOptionIds?.length ?? 0} held
            </div>
          </div>
        </Link>

        {/* Vault */}
        <Link href="/vault" style={{ textDecoration: "none" }}>
          <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 3, padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Vault
              </span>
              <Badge label="Deposits" color="var(--green)" />
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 22, color: "var(--text)" }}>
              {receiptIds?.length ?? 0}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
              active deposits
            </div>
          </div>
        </Link>
      </div>
    </Card>
  );
}
