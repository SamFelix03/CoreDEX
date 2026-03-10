import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ProtocolOverview } from "@/components/dashboard/ProtocolOverview";
import { UserPositions } from "@/components/dashboard/UserPositions";

export default function DashboardPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <div style={{ height: 52 }} />

      {/* Ticker */}
      <div style={{ height: 28, overflow: "hidden", borderBottom: "1px solid var(--border)", background: "var(--surface2)", display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 48, whiteSpace: "nowrap", animation: "ticker 30s linear infinite" }}>
          {Array(2).fill(["Coretime Forwards", "European Options", "Yield Vault", "XCM v5 Settlement", "Black-Scholes Pricing", "CoretimeOracle PVM", "Asset Hub"]).flat().map((t, i) => (
            <span key={i} style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em" }}>
              <span style={{ color: "var(--pink)", marginRight: 4 }}>&#x25C8;</span>{t}
            </span>
          ))}
        </div>
      </div>

      <main style={{ flex: 1, maxWidth: 1100, margin: "0 auto", width: "100%", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <ProtocolOverview />
        <UserPositions />
      </main>
      <Footer />
    </div>
  );
}
