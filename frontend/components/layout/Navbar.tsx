"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/forwards", label: "Forwards" },
  { href: "/options", label: "Options" },
  { href: "/vault", label: "Vault" },
];

const navLinkStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 14px",
  borderRadius: 6,
  textDecoration: "none",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.06em",
  background: active ? "rgba(135,206,235,0.25)" : "transparent",
  color: active ? "var(--pink)" : "var(--muted)",
  border: active ? "1px solid rgba(135,206,235,0.5)" : "1px solid transparent",
  transition: "all 0.25s var(--ease-out-expo)",
});

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: 56,
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid var(--border)",
        background: "rgba(8,8,9,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        padding: "0 24px",
        gap: 28,
      }}
    >
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          flexShrink: 0,
          transition: "transform 0.2s var(--ease-out-expo), opacity 0.2s",
        }}
        className="nav-logo"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="10" stroke="var(--pink)" strokeWidth="1.5" />
          <rect x="6" y="6" width="4" height="4" fill="var(--pink)" rx="0.5" />
          <rect x="12" y="6" width="4" height="4" fill="var(--pink)" opacity="0.7" rx="0.5" />
          <rect x="6" y="12" width="4" height="4" fill="var(--pink)" opacity="0.7" rx="0.5" />
          <rect x="12" y="12" width="4" height="4" fill="var(--pink)" opacity="0.4" rx="0.5" />
        </svg>
        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "var(--text)" }}>
          CoreDEX
        </span>
      </Link>

      <div style={{ display: "flex", gap: 4 }}>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            style={navLinkStyle(pathname === n.href)}
          >
            {n.label}
          </Link>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "6px 12px",
          background: "var(--surface2)",
          transition: "border-color 0.2s, background 0.2s",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--green)",
            display: "inline-block",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>
          Asset Hub
        </span>
      </div>

      <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
    </nav>
  );
}

