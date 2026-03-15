"use client";

/* Static background: layered blue glows positioned for balance; ghost area stays dark */

const BG_BASE = "#030305";

const GLOW_TOP_LEFT =
  "radial-gradient(ellipse 100% 80% at 20% 15%, rgba(11, 29, 153, 0.35) 0%, rgba(0, 65, 193, 0.12) 35%, transparent 60%)";

const GLOW_CENTER_LEFT =
  "radial-gradient(ellipse 70% 60% at 35% 50%, rgba(22, 61, 185, 0.2) 0%, transparent 55%)";

const GLOW_BOTTOM_RIGHT =
  "radial-gradient(ellipse 80% 70% at 85% 85%, rgba(11, 29, 153, 0.15) 0%, transparent 50%)";

const OVERLAY_GRADIENT =
  "linear-gradient(90deg, rgba(0,0,0,0.2) 0%, transparent 45%, transparent 55%, rgba(0,0,0,0.55) 100%)";

export function LandingBackground() {
  return (
    <div
      className="fixed inset-0 z-0 min-h-screen w-full overflow-hidden"
      aria-hidden
      style={{ background: BG_BASE }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: GLOW_TOP_LEFT }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: GLOW_CENTER_LEFT }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: GLOW_BOTTOM_RIGHT }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: OVERLAY_GRADIENT }}
      />
    </div>
  );
}
