"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  default:
    "bg-white text-[#0041C1] hover:bg-white/90 shadow-md transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
  outline:
    "border border-white/40 bg-transparent text-white hover:bg-white/10 hover:border-white",
  ghost:
    "text-muted-foreground hover:bg-secondary hover:text-foreground",
  destructive: "bg-destructive text-white hover:bg-destructive/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
};

const sizeVariants = {
  default: "h-10 px-6 py-2 rounded-lg text-sm font-medium",
  sm: "h-8 rounded-md px-3 text-xs font-medium",
  lg: "h-11 rounded-lg px-8 text-sm font-medium",
  icon: "size-10 rounded-lg",
  "icon-sm": "size-8 rounded-md",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof sizeVariants;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          buttonVariants[variant],
          sizeVariants[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="size-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Processing…</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
