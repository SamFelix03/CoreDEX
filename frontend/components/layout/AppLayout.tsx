"use client";

import type { ReactNode } from "react";
import { GodRays } from "@paper-design/shaders-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function AppLayout({ children, title, description, actions }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background relative">
      {/* Blue aurora across the whole section, source on the right */}
      <div
        className="fixed inset-0 lg:left-64 top-0 bottom-0 right-0 z-0 pointer-events-none"
        aria-hidden
      >
        <GodRays
          colorBack="#08080900"
          colors={["#2452F16E", "#163DB9F0", "#0B1D9988", "#022474aa"]}
          colorBloom="#2452F1"
          offsetX={1.15}
          offsetY={-0.2}
          intensity={0.85}
          spotty={0.45}
          midSize={10}
          midIntensity={0}
          density={0.14}
          bloom={0.18}
          speed={0.8}
          scale={1.8}
          style={{
            height: "100%",
            width: "100%",
            position: "absolute",
            top: 0,
            right: 0,
          }}
        />
      </div>

      <div className="hidden lg:block relative z-10">
        <Sidebar />
      </div>

      <main className="flex-1 flex flex-col min-w-0 lg:ml-64 relative z-10">
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <Header title={title} description={description} actions={actions} />
          <div className="mt-6 md:mt-8 space-y-6 md:space-y-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
