"use client";

import { createContext, useContext, type ReactNode } from "react";

type OverlayContextValue = {
  closeAndNavigate: (href: string) => void;
};

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function OverlayProvider({
  children,
  closeAndNavigate,
}: {
  children: ReactNode;
  closeAndNavigate: (href: string) => void;
}) {
  return (
    <OverlayContext.Provider value={{ closeAndNavigate }}>
      {children}
    </OverlayContext.Provider>
  );
}

export function useOverlayContext() {
  return useContext(OverlayContext);
}
