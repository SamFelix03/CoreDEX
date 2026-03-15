"use client";

const TICKER_ITEMS = [
  "Coretime Forwards",
  "European Options",
  "Yield Vault",
  "XCM v5 Settlement",
  "Black-Scholes Pricing",
  "CoretimeOracle PVM",
  "Asset Hub",
];

export function Ticker() {
  const repeated = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div
      className="animate-fade-in"
      style={{
        height: 32,
        overflow: "hidden",
        borderBottom: "1px solid var(--border)",
        background: "linear-gradient(180deg, var(--surface2) 0%, var(--surface) 100%)",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 48,
          whiteSpace: "nowrap",
          animation: "ticker 35s linear infinite",
        }}
      >
        {repeated.map((t, i) => (
          <span
            key={i}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              color: "var(--muted)",
              letterSpacing: "0.1em",
            }}
          >
            <span style={{ color: "var(--pink)", marginRight: 6 }}>◆</span>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
