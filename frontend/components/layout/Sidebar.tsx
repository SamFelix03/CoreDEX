"use client";

import { LayoutDashboard, ArrowLeftRight, Diamond, Vault } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOverlayContext } from "@/contexts/OverlayContext";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: ArrowLeftRight, label: "Forwards", href: "/forwards" },
  { icon: Diamond, label: "Options", href: "/options" },
  { icon: Vault, label: "Vault", href: "/vault" },
];

export function Sidebar() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const pathname = usePathname();
  const overlay = useOverlayContext();

  const NavLink = overlay
    ? ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
        <button
          type="button"
          onClick={() => overlay.closeAndNavigate(href)}
          className={className}
        >
          {children}
        </button>
      )
    : ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
        <Link href={href} className={className}>
          {children}
        </Link>
      );

  return (
    <aside className="fixed top-0 left-0 z-40 w-64 h-screen border-r border-border bg-card overflow-y-auto">
      <div className="flex flex-col p-4">
        <NavLink href="/" className="flex items-center gap-3 mb-8 group cursor-pointer">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary transition-transform duration-300 group-hover:scale-105 shadow-md">
            <div className="grid grid-cols-2 gap-0.5 p-1">
              <div className="size-1.5 rounded-sm bg-primary-foreground/90" />
              <div className="size-1.5 rounded-sm bg-primary-foreground/60" />
              <div className="size-1.5 rounded-sm bg-primary-foreground/60" />
              <div className="size-1.5 rounded-sm bg-primary-foreground/40" />
            </div>
          </div>
          <span className="text-lg font-semibold text-foreground font-display">
            CoreDEX
          </span>
        </NavLink>

        <nav className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground mb-3 px-2.5 uppercase tracking-wider">
            Protocol
          </p>
          {menuItems.map((item) => {
            const isActive = pathname === item.href || (overlay && item.href === "/dashboard");
            return (
              <div
                key={item.label}
                onMouseEnter={() => setHoveredItem(item.label)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <NavLink
                  href={item.href}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 text-left",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    hoveredItem === item.label && !isActive && "translate-x-0.5"
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2">
            <span className="size-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Asset Hub
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
