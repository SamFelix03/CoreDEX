"use client";

import { useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { parseAbiItem, formatUnits } from "viem";

import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { optionsEngineContract } from "@/lib/contracts";
import { blocksToTime, formatDOT } from "@/lib/utils";
import { DOT_DECIMALS, ASSET_HUB_CHAIN_ID } from "@/constants";

type OptionTypeFilter = "all" | "call" | "put";
type RegionFilter = "all" | string;
type StrikeFilter = "all" | string;

type TradePoint = {
  optionId: bigint;
  optionType: number;
  coretimeRegion: bigint;
  strikePriceDOT: bigint;
  premiumDOT: bigint;
  expiryBlock: bigint;
  blockNumber: bigint;
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
};

const BLOCK_TIME_SECONDS = 12; // Used only for the UI "approx time"; x-axis uses exact block numbers.

function dotToNumber(value: bigint) {
  // Keep it simple for chart scaling; the on-chain values come from uint256 with 18 decimals.
  return Number(formatUnits(value, DOT_DECIMALS));
}

function sortBigintAsc(a: bigint, b: bigint) {
  return a < b ? -1 : a > b ? 1 : 0;
}

type Timeframe = "1d" | "7d" | "30d";

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

type TradeScope = "market" | "mine";

export function OptionsMarketChart() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: ASSET_HUB_CHAIN_ID });

  const [scope, setScope] = useState<TradeScope>("market");
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [optionTypeFilter, setOptionTypeFilter] = useState<OptionTypeFilter>("all");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  const [strikeFilter, setStrikeFilter] = useState<StrikeFilter>("all");

  const purchasedEvent = useMemo(
    () =>
      parseAbiItem(
        "event OptionPurchased(uint256 indexed optionId, address indexed holder)"
      ),
    []
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["options:purchased", scope, address, timeframe],
    enabled: scope === "market" || !!address,
    queryFn: async () => {
      const mineAddress = address?.toLowerCase();
      if (!publicClient) throw new Error("RPC client unavailable");
      const pc = publicClient;

      const toBlock = await pc.getBlockNumber();
      const lookbackBlocks = getLookbackBlocks(timeframe);
      const fromBlock = toBlock > lookbackBlocks ? toBlock - lookbackBlocks : 0n;
      const logs = await pc.getLogs({
        address: optionsEngineContract.address,
        event: purchasedEvent,
        fromBlock,
        toBlock,
      });

      type PurchasedArgs = { holder?: string; optionId?: bigint };

      const relevantLogs =
        scope === "mine"
          ? mineAddress
            ? logs.filter((l) => {
                const args = l.args as unknown as PurchasedArgs;
                return args.holder?.toLowerCase?.() === mineAddress;
              })
            : []
          : logs;

      const optionIds = Array.from(
        new Set(
          relevantLogs
            .map((l) => {
              const args = l.args as unknown as PurchasedArgs;
              return args.optionId;
            })
            .filter((v): v is bigint => v !== undefined)
        )
      ).slice(0, 200);

      // Fetch option structs so we can plot premiumDOT (the option "price") at the time it was purchased.
      const optionsById = new Map<bigint, TradePoint>();
      await Promise.all(
        optionIds.map(async (optionId) => {
          const d = (await pc.readContract({
            address: optionsEngineContract.address,
            abi: optionsEngineContract.abi,
            functionName: "options",
            args: [optionId],
          })) as unknown as unknown[];

          const tradePointBase = {
            optionId,
            // Solidity tuple order:
            //   optionId, writer, holder, coretimeRegion, strikePriceDOT,
            //   premiumDOT, expiryBlock, optionType, status
            optionType: Number(d[7]),
            coretimeRegion: d[3] as bigint,
            strikePriceDOT: d[4] as bigint,
            premiumDOT: d[5] as bigint,
            expiryBlock: d[6] as bigint,
          };

          // We'll attach blockNumber later from the OptionPurchased log.
          optionsById.set(optionId, { ...tradePointBase, blockNumber: 0n });
        })
      );

      const tradePoints: TradePoint[] = relevantLogs
        .map((l) => {
          const args = l.args as unknown as PurchasedArgs;
          const optionId = args.optionId;
          if (optionId === undefined) return null;
          const base = optionsById.get(optionId);
          if (!base) return null;
          return {
            ...base,
            blockNumber: l.blockNumber as bigint,
          };
        })
        .filter(Boolean) as TradePoint[];

      return {
        fromBlock,
        toBlock,
        tradePoints,
      };
    },
  });

  const { filteredTradePoints, derived } = useMemo(() => {
    const tradePoints = data?.tradePoints ?? [];

    const filtered = tradePoints.filter((tp) => {
      const matchesType =
        optionTypeFilter === "all" ||
        (optionTypeFilter === "call" && tp.optionType === 0) ||
        (optionTypeFilter === "put" && tp.optionType === 1);

      const matchesRegion = regionFilter === "all" || String(tp.coretimeRegion) === regionFilter;
      const matchesStrike = strikeFilter === "all" || String(tp.strikePriceDOT) === strikeFilter;

      return matchesType && matchesRegion && matchesStrike;
    });

    const regionOptions = Array.from(new Set(tradePoints.map((t) => String(t.coretimeRegion))))
      .sort((a, b) => sortBigintAsc(BigInt(a), BigInt(b)))
      .slice(0, 50);

    const strikeOptionsAll = Array.from(new Set(tradePoints.map((t) => String(t.strikePriceDOT))))
      .sort((a, b) => sortBigintAsc(BigInt(a), BigInt(b)))
      .slice(0, 50);

    const expiryOptions = Array.from(new Set(tradePoints.map((t) => t.expiryBlock))).sort(sortBigintAsc).slice(0, 5);

    return {
      filteredTradePoints: filtered,
      derived: {
        regionOptions,
        strikeOptionsAll,
        expiryOptions,
      },
    };
  }, [data?.tradePoints, optionTypeFilter, regionFilter, strikeFilter]);

  const chart = useMemo(() => {
    if (!data) return null;

    const lookbackBlocks = data.toBlock - data.fromBlock;
    const intervalBlocks = pickCandleIntervalBlocks(lookbackBlocks, timeframe);
    const candleCount = Number((lookbackBlocks / intervalBlocks) + 1n);

    const premiumValues = filteredTradePoints.map((tp) => dotToNumber(tp.premiumDOT));
    const hasValues = premiumValues.length > 0;
    const minN = hasValues ? Math.min(...premiumValues) : 0;
    const maxN = hasValues ? Math.max(...premiumValues) : 1;

    const pad = maxN === minN ? 1 : (maxN - minN) * 0.08;
    const scaleMin = minN - pad;
    const scaleMax = maxN + pad;

    const buckets = Array.from({ length: candleCount }, (_, idx) => {
      const startBlock = data.fromBlock + BigInt(idx) * intervalBlocks;
      const endBlock = startBlock + intervalBlocks;
      return {
        idx,
        startBlock,
        endBlock,
        trades: [] as TradePoint[],
      };
    });

    for (const tp of filteredTradePoints) {
      if (tp.blockNumber < data.fromBlock || tp.blockNumber > data.toBlock) continue;
      const idx = Number((tp.blockNumber - data.fromBlock) / intervalBlocks);
      if (idx < 0 || idx >= buckets.length) continue;
      buckets[idx].trades.push(tp);
    }

    const candles: (Candle | null)[] = buckets.map((b) => {
      if (b.trades.length === 0) return null;
      b.trades.sort((a, c) => (a.blockNumber < c.blockNumber ? -1 : 1));

      const openN = dotToNumber(b.trades[0].premiumDOT);
      const closeN = dotToNumber(b.trades[b.trades.length - 1].premiumDOT);
      const highs = b.trades.map((t) => dotToNumber(t.premiumDOT));
      const highN = Math.max(...highs);
      const lowN = Math.min(...highs);

      return {
        idx: b.idx,
        startBlock: b.startBlock,
        endBlock: b.endBlock,
        openN,
        highN,
        lowN,
        closeN,
        count: b.trades.length,
      };
    });

    const candleCountNonEmpty = candles.filter(Boolean).length;

    // Volume = number of trades per bucket (matches DEX chart "activity" feel).
    const maxCount = candles.reduce((m, c) => Math.max(m, c?.count ?? 0), 0);

    // Upcoming expiry marker lines (closest 2 expiries within the current x-range),
    // derived from the *currently filtered* trade points.
    const nowBlock = data.toBlock;
    const upcomingExpiryOptions = Array.from(new Set(filteredTradePoints.map((t) => t.expiryBlock)))
      .sort(sortBigintAsc)
      .slice(0, 5);

    const upcoming = upcomingExpiryOptions
      .filter((b) => b >= nowBlock && b >= data.fromBlock && b <= data.toBlock + lookbackBlocks)
      .slice(0, 2);

    return {
      candles,
      intervalBlocks,
      candleCount,
      candleCountNonEmpty,
      maxCount,
      minN: scaleMin,
      maxN: scaleMax,
      upcomingExpiryBlocks: upcoming,
      nowBlock,
    };
  }, [data, filteredTradePoints, timeframe]);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverXPercent, setHoverXPercent] = useState<number>(0);

  const needsWallet = scope === "mine" && !address;
  if (needsWallet) {
    return (
      <Card className="animate-slide-in-up">
        <CardHeader label="Options Market (Premium Candles)" />
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            Connect wallet to view your bought option trading graph.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-slide-in-up">
      <CardHeader
        label="Options Market (Premium Candles)"
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
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-white/70 uppercase tracking-[0.5px]">
              Type
            </label>
            <div className="flex gap-2">
              {(["all", "call", "put"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOptionTypeFilter(t)}
                  className={
                    "flex-1 rounded-lg border py-2 text-xs font-medium uppercase tracking-wider transition-all " +
                    (optionTypeFilter === t
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80")
                  }
                >
                  {t === "all" ? "All" : t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-white/70 uppercase tracking-[0.5px]">
              Region
            </label>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value as RegionFilter)}
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

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-white/70 uppercase tracking-[0.5px]">
              Strike
            </label>
            <select
              value={strikeFilter}
              onChange={(e) => setStrikeFilter(e.target.value as StrikeFilter)}
              className="h-10 w-full rounded-lg border border-border bg-black px-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/20"
            >
              <option value="all">All</option>
              {derived.strikeOptionsAll
                .slice(0, 60)
                .map((sp) => (
                  <option key={sp} value={sp}>
                    {formatDOT(BigInt(sp))}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Chart */}
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
            <div className="text-sm font-semibold text-white/90">No option trade data in this window</div>
            <div className="mt-2 text-xs text-white/60">
              We found 0 `OptionPurchased` events for {scope === "market" ? "the market" : "your wallet"} in the last{" "}
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
                return (
                  <g key={i}>
                    <line x1={70} x2={880} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 6" />
                  </g>
                );
              })}

              {/* Candles + volume + markers */}
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
                    {/* Expiry marker lines */}
                    {chart.upcomingExpiryBlocks.map((expiryBlock) => {
                      const idx = (expiryBlock - data!.fromBlock) / chart.intervalBlocks;
                      if (idx < 0n || idx >= BigInt(chart.candleCount)) return null;
                      const x = xForIdx(Number(idx));
                      return (
                        <g key={expiryBlock.toString()}>
                          <line
                            x1={x}
                            x2={x}
                            y1={priceTop}
                            y2={volumeBottom}
                            stroke="var(--amber)"
                            strokeDasharray="6 6"
                          />
                          <text x={x + 4} y={priceTop + 14} fill="var(--amber)" fontSize="10">
                            Exp
                          </text>
                        </g>
                      );
                    })}

                    {/* Volume bars (DEX-like activity) */}
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

                    {/* Candlesticks */}
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

                    {/* Trade point markers */}
                    {filteredTradePoints.map((tp) => {
                      const idx = Number((tp.blockNumber - data!.fromBlock) / chart.intervalBlocks);
                      if (idx < 0 || idx >= chart.candleCount) return null;
                      const x = xForIdx(idx);
                      const y = yForN(dotToNumber(tp.premiumDOT));
                      const fill = tp.optionType === 0 ? "var(--cyan)" : "var(--pink)";
                      return <circle key={tp.optionId.toString()} cx={x} cy={y} r={3.2} fill={fill} stroke="var(--border)" strokeWidth="1" />;
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
                    <div>Trades: {c.count}</div>
                    <div className="text-white/60">~{blocksToTime(remainingBlocks)} ago</div>
                  </div>
                );
              })()
            ) : null}
          </div>
        )}

        <div className="text-[10px] text-white/60">
          Data source: on-chain `OptionPurchased` events from `OptionsEngine`. Candles bucket the purchased option `premiumDOT` by block ranges.
        </div>
      </CardContent>
    </Card>
  );
}

