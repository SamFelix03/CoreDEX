"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string;
  color?: string;
}

function Badge({ label, color, className, style, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors",
        className
      )}
      style={color ? { borderColor: color, color } : undefined}
      {...props}
    >
      {label}
    </span>
  );
}

export { Badge };
