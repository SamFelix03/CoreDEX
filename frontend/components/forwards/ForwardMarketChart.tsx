"use client";

import { useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { parseAbiItem, formatUnits } from "viem";

import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { forwardMarketContract } from "@/lib/contracts";
import { blocksToTime, formatDOT } from "@/lib/utils";
import { DOT_DECIMALS, ASSET_HUB_CHAIN_ID } from "@/constants";

type Timeframe = "1d" | "7d" | "30d";
type TradeScope = "market" | "mine";

type OrderCreatedTradePoint = {
  orderId: bigint;
  seller: string;
  regionId: bigint;
  strikePriceDOT: bigint;
  deliveryBlock: bigint;
  createdBlock: bigint;
};

type Candle = {
  idx: number;
  startBlock: bigint;
  endBlock: bigint;
  openN: number;
  highN: number;
  lowN: number;
  closeN: number;
  count: number;
  nearestDeliveryBlock: bigint;
};

const BLOCK_TIME_SECONDS = 12; // Approx used in the UI.

function dotToNumber(value: bigint) {
  // For chart scaling only. Keep as Number for pixel mapping.
  return Number(formatUnits(value, DOT_DECIMALS));
}

function sortBigintAsc(a: bigint, b: bigint) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function toBigint(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  // viem decodes small uint types (e.g. uint32) as `number` by default.
  // Converting here ensures chart math stays `bigint`-only.
  return BigInt(v as number | string);
}

function getLookbackBlocks(timeframe: Timeframe) {
  const seconds = timeframe === "1d"
    ? 24 * 60 * 60
    : timeframe === "7d"
      ? 7 * 24 * 60 * 60
      : 30 * 24 * 60 * 60;

  return BigInt(Math.floor(seconds / BLOCK_TIME_SECONDS));
}

function pickCandleIntervalBlocks(lookbackBlocks: bigint, timeframe: Timeframe) {
  // Target roughly "DEX-ish" candle density.
  const targetCandles = timeframe === "1d" ? 28 : timeframe === "7d" ? 40 : 60;
  const raw = lookbackBlocks / BigInt(targetCandles);
  return raw > 0n ? raw : 1n;
}

/** If all trades land in a few blocks, bucket the *data span* (not full lookback) so candles aren't one fat bar. */
function bucketWindowForTrades(
  queryFrom: bigint,
  queryTo: bigint,
  tradeBlocks: bigint[]
): { fromBlock: bigint; toBlock: bigint } {
  if (tradeBlocks.length === 0) {
    return { fromBlock: queryFrom, toBlock: queryTo };
  }
  let minB = tradeBlocks[0];
  let maxB = tradeBlocks[0];
  for (const b of tradeBlocks) {
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
  }
  const span = maxB - minB;
  const pad = span > 0n ? span / 6n + 40n : 500n;
  let fromBlock = minB > pad ? minB - pad : 0n;
  let toBlock = maxB + pad;
  if (toBlock > queryTo) toBlock = queryTo;
  if (fromBlock < queryFrom) fromBlock = queryFrom;
  let win = toBlock - fromBlock;
  if (win < 120n) {
    const mid = (minB + maxB) / 2n;
    fromBlock = mid - 60n;
    toBlock = mid + 60n;
    if (fromBlock < queryFrom) {
      toBlock += queryFrom - fromBlock;
      fromBlock = queryFrom;
    }
    if (toBlock > queryTo) {
      fromBlock -= toBlock - queryTo;
      toBlock = queryTo;
    }
    if (fromBlock < queryFrom) fromBlock = queryFrom;
  }
  return { fromBlock, toBlock };
}

export function ForwardMarketChart() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: ASSET_HUB_CHAIN_ID });

  const [scope, setScope] = useState<TradeScope>("market");
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [regionFilter, setRegionFilter] = useState<"all" | string>("all");
  const [strikeFilter, setStrikeFilter] = useState<"all" | string>("all");

  const orderCreatedEvent = useMemo(
    () =>
      parseAbiItem(
        "event OrderCreated(uint256 indexed orderId, address indexed seller, uint128 regionId, uint128 strikePriceDOT, uint32 deliveryBlock)"
      ),
    []
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["forwards:created", scope, address, timeframe],
    enabled: scope === "market" || !!address,
    queryFn: async () => {
      if (!publicClient) throw new Error("RPC client unavailable");

      const toBlock = await publicClient.getBlockNumber();
      const lookbackBlocks = getLookbackBlocks(timeframe);
      const fromBlock = toBlock > lookbackBlocks ? toBlock - lookbackBlocks : 0n;

      const logs = await publicClient.getLogs({
        address: forwardMarketContract.address,
        event: orderCreatedEvent,
        fromBlock,
        toBlock,
      });

      type OrderCreatedArgs = {
        orderId?: bigint;
        seller?: string;
        regionId?: bigint;
        strikePriceDOT?: bigint;
        deliveryBlock?: bigint;
      };

      const mineSeller = address?.toLowerCase();
      const filteredLogs =
        scope === "mine" && mineSeller
          ? logs.filter((l) => {
              const args = l.args as unknown as OrderCreatedArgs;
              return args.seller?.toLowerCase() === mineSeller;
            })
          : scope === "mine" && !mineSeller
            ? []
            : logs;

      const tradePoints: OrderCreatedTradePoint[] = filteredLogs
        .map((l) => {
          const args = l.args as unknown as OrderCreatedArgs;
          const orderId = args.orderId;
          const seller = args.seller;
          const regionId = args.regionId;
          const strikePriceDOT = args.strikePriceDOT;
          const deliveryBlock = args.deliveryBlock;

          if (
            orderId === undefined ||
            !seller ||
            regionId === undefined ||
            strikePriceDOT === undefined ||
            deliveryBlock === undefined
          ) {
            return null;
          }

          return {
            orderId,
            seller,
            regionId: toBigint(regionId),
            strikePriceDOT: toBigint(strikePriceDOT),
            deliveryBlock: toBigint(deliveryBlock),
            createdBlock: l.blockNumber as bigint,
          };
        })
        .filter(Boolean) as OrderCreatedTradePoint[];

      // Sort so candles can safely pick open/close.
      tradePoints.sort((a, b) => sortBigintAsc(a.createdBlock, b.createdBlock));

      return { fromBlock, toBlock, tradePoints };
    },
  });

  const { filteredTradePoints, derived } = useMemo(() => {
    const tradePoints = data?.tradePoints ?? [];

    const filtered = tradePoints.filter((tp) => {
      const matchesRegion = regionFilter === "all" || String(tp.regionId) === regionFilter;
      const matchesStrike = strikeFilter === "all" || String(tp.strikePriceDOT) === strikeFilter;
      return matchesRegion && matchesStrike;
    });

    const regionOptions = Array.from(new Set(tradePoints.map((t) => String(t.regionId))))
      .sort((a, b) => sortBigintAsc(BigInt(a), BigInt(b)))
      .slice(0, 50);

    const strikeOptionsAll = Array.from(new Set(tradePoints.map((t) => String(t.strikePriceDOT))))
      .sort((a, b) => sortBigintAsc(BigInt(a), BigInt(b)))
      .slice(0, 50);

    return {
      filteredTradePoints: filtered,
      derived: {
        regionOptions,
        strikeOptionsAll,
      },
    };
  }, [data?.tradePoints, regionFilter, strikeFilter]);

  const chart = useMemo(() => {
    if (!data) return null;

    const queryFrom = data.fromBlock;
    const queryTo = data.toBlock;
    const { fromBlock, toBlock } = bucketWindowForTrades(
      queryFrom,
      queryTo,
      filteredTradePoints.map((tp) => tp.createdBlock)
    );
    const lookbackBlocks = toBlock - fromBlock;
    const intervalBlocks = pickCandleIntervalBlocks(lookbackBlocks, timeframe);
    const candleCount = Number((lookbackBlocks / intervalBlocks) + 1n);

    const strikeValues = filteredTradePoints.map((tp) => dotToNumber(tp.strikePriceDOT));
    const hasValues = strikeValues.length > 0;
    const minN = hasValues ? Math.min(...strikeValues) : 0;
    const maxN = hasValues ? Math.max(...strikeValues) : 1;

    const pad = maxN === minN ? 1 : (maxN - minN) * 0.08;
    const scaleMin = minN - pad;
    const scaleMax = maxN + pad;

    const buckets = Array.from({ length: candleCount }, (_, idx) => {
      const startBlock = fromBlock + BigInt(idx) * intervalBlocks;
      const endBlock = startBlock + intervalBlocks;
      return {
        idx,
        startBlock,
        endBlock,
        trades: [] as OrderCreatedTradePoint[],
      };
    });

    for (const tp of filteredTradePoints) {
      if (tp.createdBlock < fromBlock || tp.createdBlock > toBlock) continue;
      const idx = Number((tp.createdBlock - fromBlock) / intervalBlocks);
      if (idx < 0 || idx >= buckets.length) continue;
      buckets[idx].trades.push(tp);
    }

    const candles: (Candle | null)[] = buckets.map((b) => {
      if (b.trades.length === 0) return null;

      b.trades.sort((a, c) => sortBigintAsc(a.createdBlock, c.createdBlock));

      const openN = dotToNumber(b.trades[0].strikePriceDOT);
      const closeN = dotToNumber(b.trades[b.trades.length - 1].strikePriceDOT);
      const highs = b.trades.map((t) => dotToNumber(t.strikePriceDOT));
      const highN = Math.max(...highs);
      const lowN = Math.min(...highs);
      const nearestDeliveryBlock = b.trades.reduce((min, t) => (t.deliveryBlock < min ? t.deliveryBlock : min), b.trades[0].deliveryBlock);

      return {
        idx: b.idx,
        startBlock: b.startBlock,
        endBlock: b.endBlock,
        openN,
        highN,
        lowN,
        closeN,
        count: b.trades.length,
        nearestDeliveryBlock,
      };
    });

    const candleCountNonEmpty = candles.filter(Boolean).length;

    const maxCount = candles.reduce((m, c) => Math.max(m, c?.count ?? 0), 0);

    // Marker lines for deliveries that happen within this time window.
    const uniqueDeliveries = Array.from(new Set(filteredTradePoints.map((t) => t.deliveryBlock)))
      .sort((a, b) => sortBigintAsc(a, b))
      .slice(0, 10);

    const nowBlock = data.toBlock;
    const upcoming = uniqueDeliveries
      .filter((b) => b >= fromBlock && b <= toBlock)
      .slice(0, 2);

    return {
      candles,
      intervalBlocks,
      candleCount,
      candleCountNonEmpty,
      maxCount,
      minN: scaleMin,
      maxN: scaleMax,
      upcomingDeliveryBlocks: upcoming,
      nowBlock,
      bucketFrom: fromBlock,
      bucketTo: toBlock,
    };
  }, [data, filteredTradePoints, timeframe]);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverXPercent, setHoverXPercent] = useState<number>(0);

  const needsWallet = scope === "mine" && !address;
  if (needsWallet) {
    return (
      <Card className="animate-slide-in-up">
        <CardHeader label="Forwards Market (Strike Candles)" />
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">Connect wallet to view your forward graph.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-slide-in-up">
      <CardHeader
        label="Forwards Market (Strike Candles)"
        right={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {(["1d", "7d", "30d"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeframe(t)}
                className={
                  "rounded-lg border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors " +
                  (timeframe === t
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80")
                }
              >
                {t.toUpperCase()}
              </button>
            ))}

            <div className="w-px h-6 bg-border/80 mx-1" />

            {(["market", "mine"] as const).map((s) => {
              const disabled = s === "mine" && !address;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  disabled={disabled}
                  className={
                    "rounded-lg border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors " +
                    (scope === s
                      ? "border-primary bg-primary text-white"
                      : disabled
                        ? "border-border bg-secondary text-muted-foreground/60"
                        : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80")
                  }
                >
                  {s === "market" ? "Market" : "My Trades"}
                </button>
              );
            })}
          </div>
        }
      />

      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-white/70 uppercase tracking-[0.5px]">Region</label>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-black px-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/20"
            >
              <option value="all">All</option>
              {derived.regionOptions.map((rid) => (
                <option key={rid} value={rid}>
                  {rid}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-[10px] font-mono text-white/70 uppercase tracking-[0.5px]">Strike</label>
            <select
              value={strikeFilter}
              onChange={(e) => setStrikeFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-black px-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/20"
            >
              <option value="all">All</option>
              {derived.strikeOptionsAll.slice(0, 60).map((sp) => (
                <option key={sp} value={sp}>
                  {formatDOT(BigInt(sp))} DOT
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size={18} />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            {(error as Error).message}
          </div>
        ) : !chart ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size={18} />
          </div>
        ) : chart.candleCountNonEmpty === 0 ? (
          <div className="rounded-lg border border-border bg-black/10 px-4 py-6 text-center">
            <div className="text-sm font-semibold text-white/90">No forward order data in this window</div>
            <div className="mt-2 text-xs text-white/60">
              We found 0 `OrderCreated` events for {scope === "market" ? "the market" : "your wallet"} in the last{" "}
              {timeframe.toUpperCase()}. Try `Market` scope and/or increase the timeframe.
            </div>
          </div>
        ) : (
          <div className="relative">
            <svg
              viewBox="0 0 900 340"
              preserveAspectRatio="none"
              className="w-full h-[340px] rounded-lg border border-border bg-black/20"
              onMouseLeave={() => setHoverIdx(null)}
              onMouseMove={(e) => {
                const target = e.currentTarget;
                const rect = target.getBoundingClientRect();
                const xPx = e.clientX - rect.left;
                const x = (xPx / rect.width) * 900;

                const priceLeft = 70;
                const priceRight = 20;
                const plotW = 900 - priceLeft - priceRight;
                const step = plotW / Math.max(1, chart.candleCount);
                const idx = Math.floor((x - priceLeft) / step);
                if (idx < 0 || idx >= chart.candleCount) {
                  setHoverIdx(null);
                  return;
                }
                setHoverIdx(idx);
                setHoverXPercent(((priceLeft + step * (idx + 0.5)) / 900) * 100);
              }}
            >
              {/* Background grid */}
              {Array.from({ length: 5 }, (_, i) => {
                const priceTop = 20;
                const priceBottom = 220;
                const plotH = priceBottom - priceTop;
                const y = priceBottom - (plotH * i) / 4;
                return <line key={i} x1={70} x2={880} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 6" />;
              })}

              {(() => {
                const priceTop = 20;
                const priceBottom = 220;
                const volumeTop = 235;
                const volumeBottom = 315;
                const plotW = 900 - 70 - 20;
                const plotH = priceBottom - priceTop;
                const step = plotW / Math.max(1, chart.candleCount);

                const xForIdx = (idx: number) => 70 + step * (idx + 0.5);

                const yForN = (n: number) => {
                  if (chart.maxN === chart.minN) return priceBottom - plotH / 2;
                  const t = (n - chart.minN) / (chart.maxN - chart.minN);
                  return priceBottom - t * plotH;
                };

                const candleW = Math.max(3, step * 0.6);

                return (
                  <>
                    {/* Delivery markers */}
                    {chart.upcomingDeliveryBlocks.map((deliveryBlock) => {
                      const db = toBigint(deliveryBlock);
                      const idx = (db - chart.bucketFrom) / chart.intervalBlocks;
                      if (idx < 0n || idx >= BigInt(chart.candleCount)) return null;
                      const x = xForIdx(Number(idx));
                      return (
                        <g key={db.toString()}>
                          <line
                            x1={x}
                            x2={x}
                            y1={priceTop}
                            y2={volumeBottom}
                            stroke="var(--amber)"
                            strokeDasharray="6 6"
                          />
                          <text x={x + 4} y={priceTop + 14} fill="var(--amber)" fontSize="10">
                            Del
                          </text>
                        </g>
                      );
                    })}

                    {/* Volume bars */}
                    {chart.candles.map((c, idx) => {
                      if (!c || c.count === 0) return null;
                      const height = (volumeBottom - volumeTop) * (c.count / Math.max(1, chart.maxCount));
                      const x = xForIdx(idx);
                      const barW = Math.max(2, step * 0.5);
                      const y = volumeBottom - height;
                      return (
                        <rect
                          key={`v-${idx}`}
                          x={x - barW / 2}
                          y={y}
                          width={barW}
                          height={height}
                          fill="rgba(56,189,248,0.25)"
                        />
                      );
                    })}

                    {/* Candles */}
                    {chart.candles.map((c) => {
                      if (!c) return null;
                      const x = xForIdx(c.idx);
                      const yOpen = yForN(c.openN);
                      const yClose = yForN(c.closeN);
                      const yHigh = yForN(c.highN);
                      const yLow = yForN(c.lowN);
                      const isUp = c.closeN >= c.openN;
                      const stroke = isUp ? "var(--green)" : "var(--pink)";
                      const fill = isUp ? "rgba(34,197,94,0.6)" : "rgba(236,72,153,0.6)";

                      const bodyTop = Math.min(yOpen, yClose);
                      const bodyH = Math.max(2, Math.abs(yClose - yOpen));

                      return (
                        <g key={`c-${c.idx}`}>
                          <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={stroke} strokeWidth="2" />
                          <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={fill} stroke={stroke} />
                        </g>
                      );
                    })}

                    {/* Trade markers */}
                    {filteredTradePoints.map((tp) => {
                      const idx = Number(
                        (toBigint(tp.createdBlock) - chart.bucketFrom) / chart.intervalBlocks
                      );
                      if (idx < 0 || idx >= chart.candleCount) return null;
                      const x = xForIdx(idx);
                      const y = yForN(dotToNumber(tp.strikePriceDOT));
                      const fill = "var(--cyan)";
                      return <circle key={tp.orderId.toString()} cx={x} cy={y} r={3.2} fill={fill} stroke="var(--border)" strokeWidth="1" />;
                    })}
                  </>
                );
              })()}
            </svg>

            {/* Tooltip */}
            {hoverIdx !== null && chart.candles[hoverIdx] ? (
              (() => {
                const c = chart.candles[hoverIdx]!;
                const remainingBlocks = data!.toBlock - c.startBlock;

                const deliveryInBlocks = c.nearestDeliveryBlock - data!.toBlock;
                const deliveryText =
                  deliveryInBlocks > 0n ? `Delivery in ~${blocksToTime(deliveryInBlocks)}` : "Delivery in past";

                return (
                  <div
                    className="absolute top-3 z-10 rounded-lg border border-border bg-black/80 px-3 py-2 text-[10px] text-white/90"
                    style={{ left: `${hoverXPercent}%`, transform: "translateX(-50%)" }}
                  >
                    <div className="font-semibold uppercase tracking-wider">Candle #{hoverIdx + 1}</div>
                    <div>Open: {c.openN.toFixed(4)} DOT</div>
                    <div>High: {c.highN.toFixed(4)} DOT</div>
                    <div>Low: {c.lowN.toFixed(4)} DOT</div>
                    <div>Close: {c.closeN.toFixed(4)} DOT</div>
                    <div>Orders: {c.count}</div>
                    <div className="text-white/60">{deliveryText}</div>
                    <div className="text-white/60">~{blocksToTime(remainingBlocks)} ago</div>
                  </div>
                );
              })()
            ) : null}
          </div>
        )}

        <div className="text-[10px] text-white/60">
          Data source: on-chain `OrderCreated` events from `ForwardMarket`. Candles bucket the agreed strike price (`strikePriceDOT`) by block ranges.
        </div>
      </CardContent>
    </Card>
  );
}

