"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/forwards",  label: "Forwards"  },
  { href: "/options",   label: "Options"   },
  { href: "/vault",     label: "Vault"     },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      height: 52, display: "flex", alignItems: "center",
      borderBottom: "1px solid var(--border)",
      background: "rgba(8,8,9,0.94)", backdropFilter: "blur(12px)",
      padding: "0 20px", gap: 24,
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="10" stroke="#E6007A" strokeWidth="1.5"/>
          <rect x="6" y="6" width="4" height="4" fill="#E6007A" rx="0.5"/>
          <rect x="12" y="6" width="4" height="4" fill="#E6007A" opacity="0.7" rx="0.5"/>
          <rect x="6" y="12" width="4" height="4" fill="#E6007A" opacity="0.7" rx="0.5"/>
          <rect x="12" y="12" width="4" height="4" fill="#E6007A" opacity="0.4" rx="0.5"/>
        </svg>
        <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 17, color: "var(--text)" }}>
          CoreDEX
        </span>
      </Link>

      {/* Nav links */}
      <div style={{ display: "flex", gap: 2 }}>
        {NAV.map(n => (
          <Link key={n.href} href={n.href} style={{
            padding: "5px 13px", borderRadius: 3, textDecoration: "none",
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: "0.05em",
            background: pathname === n.href ? "rgba(230,0,122,0.1)" : "transparent",
            color:      pathname === n.href ? "var(--pink)" : "var(--muted)",
            border:     pathname === n.href ? "1px solid rgba(230,0,122,0.3)" : "1px solid transparent",
            transition: "all 0.15s",
          }}>
            {n.label}
          </Link>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Protocol status pill */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        border: "1px solid var(--border)", borderRadius: 3,
        padding: "4px 10px", background: "var(--surface2)",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse 2s infinite" }} />
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--muted)" }}>
          Asset Hub
        </span>
      </div>

      <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
    </nav>
  );
}
