"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion, AnimatePresence } from "framer-motion";
import { GhostAnimation } from "@/components/landing/GhostAnimation";
import { LandingBackground } from "@/components/landing/LandingBackground";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtocolOverview } from "@/components/dashboard/ProtocolOverview";
import { UserPositions } from "@/components/dashboard/UserPositions";
import { OverlayProvider } from "@/contexts/OverlayContext";

const fadeInDown = {
  initial: { opacity: 0, y: -16 },
  animate: { opacity: 1, y: 0 },
};
const t = { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const };

export default function LandingPage() {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const closeAndNavigate = (href: string) => {
    setIsExpanded(false);
    router.push(href);
  };

  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isExpanded]);

  return (
    <>
      <main className="relative min-h-screen flex flex-col">
        <LandingBackground />
        {/* was: aurora — match bg’s GodRays (offset, spotty, bloom) with dark palette */}
        <nav className="relative z-50 flex items-center justify-between h-16 px-6 bg-transparent">
          <span className="font-landing-logo text-2xl md:text-3xl font-semibold text-white tracking-tight">
            CoreDEX
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="font-mono text-[11px] text-white/60 hover:text-white uppercase tracking-widest transition-colors"
            >
              App
            </Link>
            <div className="connect-button-wrapper">
              <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
            </div>
          </div>
        </nav>

        <AnimatePresence initial={false}>
          {!isExpanded ? (
            <section
              key="landing"
              className="relative z-10 flex-1 flex flex-col lg:flex-row items-start justify-center min-h-[calc(100vh-3.5rem)] pt-20 lg:pt-28 pb-16 px-8 lg:px-12 xl:px-20 overflow-hidden gap-12 lg:gap-16"
            >
              {/* Left column: text and CTA — balanced, not flush top-left */}
              <div className="flex-1 flex flex-col items-start justify-center w-full max-w-xl text-left lg:pl-6 xl:pl-10">
                <motion.p
                  className="font-mono text-[10px] text-white/60 uppercase tracking-[0.2em] flex items-center gap-2 mb-5"
                  {...fadeInDown}
                  transition={{ ...t, delay: 0 }}
                >
                  <motion.span
                    className="size-1.5 rounded-full bg-[#0041C1] shrink-0"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  Live on Polkadot Asset Hub
                </motion.p>

                <motion.h1
                  className="font-landing text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-[1.05] text-white z-10 mb-4 uppercase"
                  style={{
                    textShadow:
                      "0 0 40px rgba(0,0,0,0.5), 0 2px 20px rgba(0,0,0,0.4)",
                  }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...t, delay: 0.2 }}
                >
                  Coretime derivatives{" "}
                  <motion.span
                    className="font-landing inline-block gradient-text-ghost"
                    style={{
                      color: "transparent",
                      WebkitTextFillColor: "transparent",
                      textShadow: "none",
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    made simple
                  </motion.span>
                </motion.h1>

                <motion.p
                  className="font-mono text-sm text-white/80 max-w-md mb-8"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...t, delay: 0.35 }}
                >
                  <span className="font-bold text-white">Forwards</span>, <span className="font-bold text-white">options</span> & <span className="font-bold text-white">yield</span>. On-chain via <span className="font-bold text-white">XCM v5</span>.
                </motion.p>

                <motion.div
                  className="inline-block relative"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...t, delay: 0.5 }}
                >
                  <motion.div
                    layout
                    layoutId="cta-card"
                    style={{ borderRadius: 100 }}
                    className="absolute inset-0 bg-black border border-white items-center justify-center transform-gpu will-change-transform"
                  />
                  <motion.button
                    layout={false}
                    onClick={() => setIsExpanded(true)}
                    className="relative h-14 px-8 py-3.5 rounded-full font-landing text-sm font-medium text-white tracking-tight inline-flex items-center gap-2 hover:opacity-95 transition-opacity"
                  >
                    Enter CoreDEX
                    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </motion.button>
                </motion.div>
              </div>

              {/* Right column: ghost — right-aligned, large */}
              <motion.div
                className="relative w-full lg:w-[50%] lg:min-w-[420px] flex justify-end items-start shrink-0 lg:pl-8"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.85, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="relative w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[380px] xl:max-w-[420px]">
                  <GhostAnimation />
                  <div
                    className="absolute inset-0 -z-10 rounded-full blur-[120px] opacity-30 pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(ellipse 70% 70% at 50% 50%, rgba(0,65,193,0.5) 0%, rgba(36,82,241,0.25) 45%, transparent 70%)",
                    }}
                  />
                </div>
              </motion.div>
            </section>
          ) : (
            <motion.div
              key="dashboard-overlay"
              className="fixed inset-0 z-[100] flex items-center justify-center p-0"
              initial={false}
            >
              <motion.div
                layoutId="cta-card"
                layout
                transition={{
                  type: "spring",
                  stiffness: 320,
                  damping: 32,
                  mass: 0.9,
                }}
                style={{ borderRadius: 24 }}
                className="relative flex h-full w-full overflow-hidden bg-background transform-gpu will-change-transform"
              >
              <div className="h-full w-full overflow-y-auto flex flex-col">
                <OverlayProvider closeAndNavigate={closeAndNavigate}>
                  <AppLayout
                    title="Dashboard"
                    description="Protocol overview and your positions."
                  >
                    <ProtocolOverview />
                    <UserPositions />
                  </AppLayout>
                </OverlayProvider>
              </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
