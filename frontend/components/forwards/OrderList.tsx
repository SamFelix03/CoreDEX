"use client";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAccount } from "wagmi";
import { useForwardOrders, useForwardOrder, useMatchOrder, useCancelOrder, useSettleForward } from "@/hooks/useForwardOrders";
import { formatDOT, truncateAddress, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/utils";

function OrderRow({ orderId }: { orderId: bigint }) {
  const { order, isLoading } = useForwardOrder(orderId);
  const { address } = useAccount();
  const { matchOrder, isPending: matchPending } = useMatchOrder();
  const { cancel, isPending: cancelPending } = useCancelOrder();
  const { settle, isPending: settlePending } = useSettleForward();

  if (isLoading || !order) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--muted)" }}>
          Loading...
        </td>
      </tr>
    );
  }

  const statusLabel = ORDER_STATUS_LABELS[order.status] ?? "Unknown";
  const statusColor = ORDER_STATUS_COLORS[statusLabel] ?? "var(--muted)";
  const isSeller = address?.toLowerCase() === order.seller.toLowerCase();
  const isBuyer  = address?.toLowerCase() === order.buyer.toLowerCase();

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "var(--text)" }}>
        #{String(order.orderId)}
      </td>
      <td style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--muted)" }}>
        {String(order.regionId)}
      </td>
      <td style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--cyan)" }}>
        {formatDOT(order.strikePriceDOT)} DOT
      </td>
      <td style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--muted)" }}>
        {truncateAddress(order.seller)}
      </td>
      <td style={{ padding: "8px 12px" }}>
        <Badge label={statusLabel} color={statusColor} />
      </td>
      <td style={{ padding: "8px 12px", display: "flex", gap: 4 }}>
        {order.status === 0 && !isSeller && (
          <Button size="sm" onClick={() => matchOrder(order.orderId)} loading={matchPending}>
            Match
          </Button>
        )}
        {order.status === 0 && isSeller && (
          <Button size="sm" variant="ghost" onClick={() => cancel(order.orderId)} loading={cancelPending}>
            Cancel
          </Button>
        )}
        {order.status === 1 && (isSeller || isBuyer) && (
          <Button size="sm" variant="outline" onClick={() => settle(order.orderId)} loading={settlePending}>
            Settle
          </Button>
        )}
      </td>
    </tr>
  );
}

export function OrderList() {
  const { address } = useAccount();
  const { sellerOrderIds, buyerOrderIds } = useForwardOrders(address);

  const allOrderIds = [
    ...(sellerOrderIds ?? []),
    ...(buyerOrderIds ?? []),
  ].filter((v, i, a) => a.findIndex(x => x === v) === i);

  return (
    <Card>
      <CardHeader label="Your Forward Orders" />
      {allOrderIds.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "var(--muted)" }}>
            {address ? "No forward orders found" : "Connect wallet to view orders"}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Order", "Region", "Strike", "Seller", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "left" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allOrderIds.map(id => (
                <OrderRow key={String(id)} orderId={id} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
