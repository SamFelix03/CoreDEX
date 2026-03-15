"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ArrowLeftRight, Diamond, Vault } from "lucide-react";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: ArrowLeftRight, label: "Forwards", href: "/forwards" },
  { icon: Diamond, label: "Options", href: "/options" },
  { icon: Vault, label: "Vault", href: "/vault" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden flex size-10 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-all"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Slide-out panel */}
      <div
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 max-w-[85vw] bg-card border-r border-border shadow-xl transition-transform duration-300 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2"
            >
              <span className="text-lg font-semibold text-foreground font-['DM_Serif_Display',serif]">
                CoreDEX
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>
          <nav className="space-y-0.5">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
