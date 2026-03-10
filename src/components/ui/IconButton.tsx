import React, { forwardRef } from "react";
import { clsx } from "clsx";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "subtle" | "danger";
  active?: boolean;
  loading?: boolean;
  "aria-label"?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      size = "md",
      variant = "ghost",
      active = false,
      loading = false,
      disabled = false,
      className,
      "aria-label": ariaLabel,
      title,
      ...props
    },
    ref,
  ) => {
    // Determine size classes
    const sizeClasses = {
      sm: "h-6 w-6",
      md: "h-7 w-7",
      lg: "h-8 w-8",
    }[size];

    // Determine variant classes
    const variantClasses = {
      ghost: "hover:bg-[var(--bg-hover)] text-current",
      subtle: "hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]",
      danger: "hover:bg-red-500/10 text-red-500 hover:text-red-600",
    }[variant];

    // Determine active classes
    const activeClasses =
      active && variant === "ghost"
        ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
        : "";

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        aria-busy={loading}
        aria-pressed={active}
        aria-label={ariaLabel || title}
        title={title}
        data-active={active}
        className={clsx(
          "inline-flex items-center justify-center rounded transition-colors duration-150 focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 focus:ring-offset-[var(--bg-primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          sizeClasses,
          !active && variantClasses,
          activeClasses,
          className,
        )}
        {...props}
      >
        {loading ? (
          <svg
            className="h-3/4 w-3/4 animate-spin opacity-70"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        ) : (
          icon
        )}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
