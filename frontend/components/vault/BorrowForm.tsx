"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FutureRelayTimeInput } from "@/components/ui/FutureRelayTimeInput";
import { TxSuccessWithExplorer } from "@/components/ui/TxSuccessWithExplorer";
import { useVaultBorrow, useVaultStats } from "@/hooks/useVault";
import { useEstimatedRelayBlock } from "@/hooks/useEstimatedRelayBlock";
import { ASSET_HUB_CHAIN_ID, RELAY_BLOCK_UINT32_MAX } from "@/constants";
import { finalizeEvmFutureBlockForTx } from "@/lib/relayBlockEstimate";
import { formatTransactionError } from "@/lib/walletError";
import { VAULT_RATE_PRECISION } from "@/lib/vaultBorrow";
import { formatDOT, blocksToTime } from "@/lib/utils";

/** Default core count matches scripts (`borrow(1, durationBlocks)`). */
const DEFAULT_CORE = "1";

export function BorrowForm() {
  const [coreCount, setCoreCount] = useState(DEFAULT_CORE);
  const [returnWhen, setReturnWhen] = useState(() =>
    format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm")
  );
  const [blockFinalizeNote, setBlockFinalizeNote] = useState<string | null>(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: ASSET_HUB_CHAIN_ID });
  const wrongChain = chainId !== ASSET_HUB_CHAIN_ID;

  /** Wagmi / RPC may return block.number as bigint, number, or serialized string — never mix with `>` vs BigInt (throws). */
  const toBigIntSafe = (v: bigint | number | string | null | undefined): bigint | null => {
    if (v == null) return null;
    try {
      return BigInt(v as bigint | number | string);
    } catch {
      return null;
    }
  };

  const targetMs = useMemo(() => {
    if (!returnWhen?.trim()) return null;
    const t = new Date(returnWhen).getTime();
    return Number.isFinite(t) ? t : null;
  }, [returnWhen]);

  const {
    estimatedBlock: dueBlock,
    error: blockEstError,
    isLoadingHead,
    latestBlockNumber,
  } = useEstimatedRelayBlock(targetMs);

  const { stats } = useVaultStats();
  const { borrow, isPending, isSuccess, error, reset, hash } = useVaultBorrow();

  const coreN = Number.parseInt(coreCount.trim(), 10);
  const coreValid =
    Number.isFinite(coreN) && coreN >= 1 && coreN <= 0xffff_ffff;

  /** UI preview: blocks from cached head to estimated due block (same idea as forwards). */
  const dueBi = toBigIntSafe(dueBlock);
  const latestBi = toBigIntSafe(latestBlockNumber);
  const previewDurationBlocks =
    dueBi !== null && latestBi !== null && dueBi > latestBi ? dueBi - latestBi : null;

  const previewFee = useMemo(() => {
    if (!stats || !coreValid || previewDurationBlocks === null || previewDurationBlocks < 1n) return null;
    return (BigInt(coreN) * previewDurationBlocks * stats.lendingRate) / VAULT_RATE_PRECISION;
  }, [stats, coreValid, coreN, previewDurationBlocks]);

  /**
   * Match `CreateAskForm`: only require a valid estimated target block + head loaded — not extra duration math
   * that can throw on BigInt vs number comparison. Final duration is derived at click time (after finalize).
   */
  const canSubmit = coreValid && dueBlock !== null && !blockEstError && !isLoadingHead;

  const submitBlockers: string[] = [];
  if (!coreValid) submitBlockers.push("Enter a valid core count (1–2³²−1).");
  if (isLoadingHead) submitBlockers.push("Waiting for chain head…");
  if (blockEstError) submitBlockers.push(blockEstError);
  if (dueBlock === null && !isLoadingHead && !blockEstError && targetMs !== null) {
    submitBlockers.push("Could not estimate return-by block — check datetime and RPC.");
  }
  if (dueBlock === null && targetMs === null) submitBlockers.push("Pick a return-by date and time.");

  const borrowDisabled = !canSubmit || wrongChain || !isConnected || !address;
  const borrowDisabledHint = wrongChain
    ? `Switch to Polkadot Hub TestNet (chain ${ASSET_HUB_CHAIN_ID}).`
    : !isConnected || !address
      ? "Connect your wallet."
      : !canSubmit && submitBlockers.length > 0
        ? submitBlockers[0]
        : null;

  const handleBorrow = async () => {
    if (!canSubmit || dueBi === null) return;
    if (!address) {
      console.error("borrow: no wallet address");
      return;
    }
    if (!publicClient) {
      console.error("borrow: no public client");
      return;
    }
    setBlockFinalizeNote(null);
    try {
      const { block: dueFinal, error: finErr, adjusted } = await finalizeEvmFutureBlockForTx(
        publicClient,
        dueBi
      );
      if (finErr) {
        setBlockFinalizeNote(finErr);
        return;
      }
      const head = await publicClient.getBlockNumber();
      let durationBlocks = dueFinal - head;
      if (durationBlocks < 1n) durationBlocks = 1n;
      if (durationBlocks > RELAY_BLOCK_UINT32_MAX) {
        setBlockFinalizeNote(
          "Computed loan duration exceeds uint32 max. Choose an earlier return-by time."
        );
        return;
      }
      if (adjusted) {
        setBlockFinalizeNote(
          `Loan duration set to ${durationBlocks.toString()} blocks (~${blocksToTime(
            durationBlocks
          )}) — fresh RPC head + minimum block lead applied (same pattern as forward asks).`
        );
      }
      await borrow(BigInt(coreN), durationBlocks);
    } catch (e) {
      console.error("borrow failed:", e);
    }
  };

  return (
    <Card className="animate-slide-in-up">
      <CardHeader label="Borrow Regions" />
      <CardContent className="flex flex-col gap-4">
        {!isConnected && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Connect your wallet to borrow.
          </div>
        )}
        {wrongChain && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Switch to <span className="font-mono">Polkadot Hub TestNet</span> (chain {ASSET_HUB_CHAIN_ID}).
          </div>
        )}
        <Input
          label="Core count"
          type="number"
          min={1}
          placeholder={DEFAULT_CORE}
          value={coreCount}
          onChange={(e) => {
            reset();
            setCoreCount(e.target.value);
          }}
          disabled={wrongChain}
        />
        <FutureRelayTimeInput
          label="Return by"
          description="Loan length is the number of EVM blocks from the current head until this time (~12s per block). If the pick is too soon, we add the same minimum block lead as forward asks."
          value={returnWhen}
          onChange={(v) => {
            reset();
            setReturnWhen(v);
          }}
          estimatedBlock={dueBlock}
          estimateError={blockEstError}
          isLoadingHead={isLoadingHead}
          latestBlockNumber={latestBlockNumber}
        />
        {previewDurationBlocks !== null && previewDurationBlocks >= 1n && !blockEstError && (
          <p className="text-xs text-muted-foreground">
            Approx. duration from current head:{" "}
            <span className="font-mono text-foreground">{previewDurationBlocks.toString()}</span> blocks (~
            {blocksToTime(previewDurationBlocks)}). Final value is recomputed at send time from a fresh head.
          </p>
        )}
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          On-chain: <span className="font-mono">borrow(uint32 coreCount, uint32 durationBlocks)</span>. The vault pulls
          the lending fee via DOT <span className="font-mono">transferFrom</span> — you may be asked to{" "}
          <strong>approve</strong> the vault first, then <strong>borrow</strong>.
        </p>
        {previewFee !== null && (
          <p className="text-xs text-muted-foreground">
            Estimated lending fee (from current rate):{" "}
            <span className="font-mono text-foreground">{formatDOT(previewFee)} DOT</span>
          </p>
        )}
        {blockFinalizeNote && (
          <div
            className={`rounded-lg border px-4 py-3 text-xs animate-slide-in-up ${
              blockFinalizeNote.includes("fresh RPC") || blockFinalizeNote.includes("Loan duration set")
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {blockFinalizeNote}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive animate-slide-in-up whitespace-pre-wrap break-words">
            {formatTransactionError(error)}
          </div>
        )}
        {isSuccess && (
          <TxSuccessWithExplorer hash={hash}>
            <span>Borrow confirmed — lending fee paid from your DOT balance (after approval if needed).</span>
          </TxSuccessWithExplorer>
        )}
        {borrowDisabled && borrowDisabledHint && (
          <p className="text-[10px] text-muted-foreground rounded-lg border border-border/60 bg-secondary/20 px-3 py-2">
            <span className="font-semibold text-foreground/90">Borrow disabled: </span>
            {borrowDisabledHint}
          </p>
        )}
        <Button
          type="button"
          onClick={handleBorrow}
          loading={isPending}
          disabled={borrowDisabled}
          className="w-full"
        >
          Borrow
        </Button>
      </CardContent>
    </Card>
  );
}
