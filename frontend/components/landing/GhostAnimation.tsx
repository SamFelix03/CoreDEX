"use client";

import { MeshGradient } from "@paper-design/shaders-react";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

const GHOST_CLIP_PATH =
  "M230.809 115.385V249.411C230.809 269.923 214.985 287.282 194.495 288.411C184.544 288.949 175.364 285.718 168.26 280C159.746 273.154 147.769 273.461 139.178 280.23C132.638 285.384 124.381 288.462 115.379 288.462C106.377 288.462 98.1451 285.384 91.6055 280.23C82.912 273.385 70.9353 273.385 62.2415 280.23C55.7532 285.334 47.598 288.411 38.7246 288.462C17.4132 288.615 0 270.667 0 249.359V115.385C0 51.6667 51.6756 0 115.404 0C179.134 0 230.809 51.6667 230.809 115.385Z";

/* Blue shades to match app (primary #0041C1 and palette) */
const COLORS = [
  "#0041C1", // App primary
  "#2452F1",
  "#87CEEB", // Sky blue
  "#4A90E2", // Medium blue
  "#163DB9",
  "#0B1D99",
];

export function GhostAnimation() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (mousePosition.x - centerX) * 0.08;
    const deltaY = (mousePosition.y - centerY) * 0.08;
    const maxOffset = 8;
    setEyeOffset({
      x: Math.max(-maxOffset, Math.min(maxOffset, deltaX)),
      y: Math.max(-maxOffset, Math.min(maxOffset, deltaY)),
    });
  }, [mousePosition]);

  return (
    <motion.div
      className="relative w-full h-full min-h-[280px] mx-auto"
      animate={{
        y: [0, -10, 0],
        scale: [1, 1.03, 1],
      }}
      transition={{
        duration: 2.8,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
      style={{ transformOrigin: "center bottom" }}
    >
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        width="231"
        height="289"
        viewBox="0 0 231 289"
        className="w-full h-auto drop-shadow-[0_0_40px_rgba(147,112,219,0.2)]"
      >
        <defs>
          <clipPath id="ghostShapeClip">
            <path d={GHOST_CLIP_PATH} />
          </clipPath>
        </defs>

        <foreignObject
          width="231"
          height="289"
          clipPath="url(#ghostShapeClip)"
          className="overflow-hidden"
        >
          <div className="w-full h-full" style={{ width: 231, height: 289 }}>
            <MeshGradient
              colors={COLORS}
              width={231}
              height={289}
              className="w-full h-full"
              speed={1}
            />
          </div>
        </foreignObject>

        <motion.g
          animate={{
            x: 80 + eyeOffset.x,
            y: 120 + eyeOffset.y,
          }}
          transition={{ type: "spring", stiffness: 150, damping: 15 }}
        >
          <motion.ellipse
            cx="0"
            cy="0"
            rx="20"
            ry="30"
            fill="#0a0a0a"
            animate={{ scaleY: [1, 0.1, 1] }}
            transition={{
              duration: 0.09,
              repeat: Infinity,
              repeatDelay: 1.2,
            }}
            style={{ transformOrigin: "center center" }}
          />
        </motion.g>
        <motion.g
          animate={{
            x: 150 + eyeOffset.x,
            y: 120 + eyeOffset.y,
          }}
          transition={{ type: "spring", stiffness: 150, damping: 15 }}
        >
          <motion.ellipse
            cx="0"
            cy="0"
            rx="20"
            ry="30"
            fill="#0a0a0a"
            animate={{ scaleY: [1, 0.1, 1] }}
            transition={{
              duration: 0.09,
              repeat: Infinity,
              repeatDelay: 1.2,
            }}
            style={{ transformOrigin: "center center" }}
          />
        </motion.g>
      </svg>
    </motion.div>
  );
}
