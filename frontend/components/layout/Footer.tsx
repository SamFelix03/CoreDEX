export function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid var(--border)",
      padding: "12px 20px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      background: "var(--surface)",
    }}>
      <span style={{
        fontFamily: "'IBM Plex Mono',monospace", fontSize: 10,
        color: "var(--muted)", letterSpacing: "0.08em",
      }}>
        CoreDEX — Coretime Derivatives Protocol
      </span>
      <span style={{
        fontFamily: "'IBM Plex Mono',monospace", fontSize: 10,
        color: "var(--muted)", letterSpacing: "0.08em",
      }}>
        Built on Polkadot Asset Hub
      </span>
    </footer>
  );
}
