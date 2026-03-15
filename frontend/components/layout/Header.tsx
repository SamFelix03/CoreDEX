"use client";

import type { ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { MobileNav } from "./MobileNav";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <header className="space-y-4 animate-slide-in-up">
      <div className="flex items-center justify-between gap-3">
        <MobileNav />
        <div className="flex-1 min-w-0" />
        <div className="flex items-center gap-2">
          <ConnectButton
            accountStatus="avatar"
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight font-display">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex flex-col sm:flex-row gap-2">{actions}</div>
      )}
    </header>
  );
}
