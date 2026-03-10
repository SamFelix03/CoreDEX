"use client";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function LandingPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid var(--border)", padding: "0 24px",
        height: 52, display: "flex", alignItems: "center", gap: 16,
        background: "rgba(8,8,9,0.95)",
      }}>
        <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: "var(--text)" }}>CoreDEX</span>
        <div style={{ flex: 1 }} />
        <Link href="/dashboard" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--muted)", textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.08em" }}>Dashboard</Link>
        <ConnectButton />
      </nav>

      {/* Hero */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", gap: 32, textAlign: "center" }}>
        <div style={{ border: "1px solid var(--border2)", borderRadius: 3, padding: "4px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Live on Asset Hub</span>
        </div>

        <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 56, lineHeight: 1.1, color: "var(--text)", maxWidth: 700 }}>
          Coretime Derivatives<br />
          <span style={{ color: "var(--pink)" }}>on Polkadot</span>
        </h1>

        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, color: "var(--muted)", maxWidth: 560, lineHeight: 1.7 }}>
          Trade coretime forwards, write options, and earn yield by lending your Coretime NFTs.
          All settled trustlessly via XCM v5 on Polkadot Asset Hub.
        </p>

        {/* Protocol stats */}
        <div style={{ display: "flex", gap: 1, border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden", marginTop: 8 }}>
          {[
            { label: "Forwards",     value: "Order Book",  color: "var(--cyan)" },
            { label: "Options",      value: "Black-Scholes", color: "var(--pink)" },
            { label: "Yield Vault",  value: "Lending Pool", color: "var(--green)" },
            { label: "Settlement",   value: "XCM v5",       color: "var(--amber)" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "var(--surface)", padding: "14px 24px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 16, color }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <Link href="/dashboard" style={{
            padding: "10px 24px", borderRadius: 3, fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 12, background: "var(--pink)", color: "#fff", textDecoration: "none",
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            Open App
          </Link>
          <Link href="/forwards" style={{
            padding: "10px 24px", borderRadius: 3, fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 12, background: "transparent", color: "var(--muted)", textDecoration: "none",
            letterSpacing: "0.06em", textTransform: "uppercase",
            border: "1px solid var(--border)",
          }}>
            Trade Forwards
          </Link>
          <Link href="/options" style={{
            padding: "10px 24px", borderRadius: 3, fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 12, background: "transparent", color: "var(--muted)", textDecoration: "none",
            letterSpacing: "0.06em", textTransform: "uppercase",
            border: "1px solid var(--border)",
          }}>
            Write Options
          </Link>
        </div>
      </div>
    </main>
  );
}
