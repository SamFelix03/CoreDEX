"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoretimeNftScanMaxId } from "@/lib/coretimeNft";

const MINT_CMD = "cd smart-contracts && npm run demo:mint-region";
const MINT_CMD_ALT =
  "./node_modules/.bin/hardhat run scripts/mint-demo-region.ts --network polkadotTestNet";

export function CoretimeMintBanner() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(MINT_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left font-semibold text-foreground"
      >
        <span>Mint your Coretime NFT</span>
        {open ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
      </button>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
        Forwards, options, and vault actions need a <strong>Coretime region NFT</strong> owned by your
        wallet. The Hub testnet uses a PVM mock; mint from the repo with the <strong>same private key</strong>{" "}
        as MetaMask.
      </p>
      <div className={cn("mt-3 space-y-2 overflow-hidden transition-all", open ? "max-h-[320px]" : "max-h-0")}>
        <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1.5">
          <li>Set <code className="text-white/80">PRIVATE_KEY</code> in <code className="text-white/80">smart-contracts/.env</code> to your demo wallet.</li>
          <li>Run the mint script (install deps in <code className="text-white/80">smart-contracts</code> first).</li>
          <li>Refresh this page — your new region appears in the picker (ids are scanned up to{" "}
            <span className="font-mono text-white/70">{getCoretimeNftScanMaxId()}</span>; set{" "}
            <code className="text-white/80">NEXT_PUBLIC_CORETIME_NFT_SCAN_MAX_ID</code> if you mint higher ids).
          </li>
        </ol>
        <div className="relative rounded-lg border border-border bg-black/40 p-3 font-mono text-[10px] text-white/80 space-y-2">
          <div>{MINT_CMD}</div>
          <div className="text-white/50">or</div>
          <div className="break-all">{MINT_CMD_ALT}</div>
          <button
            type="button"
            onClick={copy}
            className="absolute top-2 right-2 rounded p-1 text-white/60 hover:text-white hover:bg-white/10"
            aria-label="Copy command"
          >
            <Copy className="size-3.5" />
          </button>
        </div>
        {copied && <p className="text-[10px] text-green-400">Copied to clipboard.</p>}
      </div>
    </div>
  );
}
