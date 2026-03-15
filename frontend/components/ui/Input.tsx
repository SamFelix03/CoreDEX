"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  suffix?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, suffix, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-[10px] font-mono font-normal text-white uppercase tracking-[0.5px]">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={type}
            ref={ref}
            className={cn(
              "flex h-10 w-full rounded-lg border-0 bg-black px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:cursor-not-allowed disabled:opacity-50",
              suffix && "pr-12",
              className
            )}
            {...props}
          />
            {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/70">
              {suffix}
            </span>
          )}
        </div>
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
