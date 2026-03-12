import React, { forwardRef } from "react";
import { clsx } from "clsx";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  badge?: string;
  shortcut?: string;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      icon,
      iconPosition = "left",
      badge,
      shortcut,
      loading = false,
      fullWidth = false,
      disabled = false,
      className,
      ...props
    },
    ref,
  ) => {
    // Determine sizing and padding
    const sizeClasses = {
      sm: "h-7 px-3 text-xs",
      md: "h-8 px-4 text-sm",
      lg: "h-10 px-5 text-base",
    }[size];

    // Determine typography/layout basics
    const baseClasses =
      "inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 select-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 focus:ring-offset-[var(--bg-primary)] disabled:opacity-50 disabled:cursor-not-allowed";

    const widthClasses = fullWidth ? "w-full" : "w-auto";

    // Determine variant styling
    const variantClasses = {
      primary:
        "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.98]",
      secondary:
        "bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:scale-[0.98]",
      ghost:
        "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:scale-[0.98]",
      danger:
        "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white active:scale-[0.98]",
    }[variant];

    return (
      <button
        ref={ref}
        type={props.type || "button"}
        disabled={disabled || loading}
        aria-busy={loading}
        className={clsx(
          baseClasses,
          sizeClasses,
          variantClasses,
          widthClasses,
          className,
        )}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 -ml-1 h-4 w-4 animate-spin opacity-70"
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
        )}

        {!loading && icon && iconPosition === "left" && (
          <span className="mr-2 inline-flex flex-shrink-0 items-center justify-center">
            {icon}
          </span>
        )}

        <span className="flex-1 truncate text-left">{children}</span>

        {!loading && icon && iconPosition === "right" && (
          <span className="ml-2 inline-flex flex-shrink-0 items-center justify-center">
            {icon}
          </span>
        )}

        {badge && (
          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-[var(--accent-subtle)] px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-[var(--accent)] uppercase">
            {badge}
          </span>
        )}

        {shortcut && (
          <kbd className="ml-auto inline-flex h-5 items-center rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-1.5 font-mono text-[10px] text-[var(--text-tertiary)] opacity-80">
            {shortcut}
          </kbd>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
