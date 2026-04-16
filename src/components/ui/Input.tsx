import React, { forwardRef } from "react";
import { clsx } from "clsx";

export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  error?: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      icon,
      iconPosition = "left",
      error,
      size = "md",
      fullWidth = false,
      disabled = false,
      ...props
    },
    ref,
  ) => {
    // Sizing
    const sizeClasses = {
      sm: "h-7 text-xs px-2.5",
      md: "h-9 text-sm px-3",
    }[size];

    // Typography & Layout
    const baseClasses =
      "input-wrapper flex items-center w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg transition-colors duration-200 outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]";

    const focusClasses = "";

    const errorClasses = error
      ? "border-red-500 [&:focus-within]:border-red-500 [&:focus-within]:[box-shadow:0_0_0_1.5px_rgba(239,68,68,0.7),0_0_8px_3px_rgba(239,68,68,0.22)]"
      : "";

    const disabledClasses = disabled
      ? "opacity-60 cursor-not-allowed bg-[var(--bg-tertiary)]"
      : "";

    // Adjusting padding if icon is present
    const iconPaddingClasses =
      icon && iconPosition === "left"
        ? size === "sm"
          ? "pl-8"
          : "pl-10"
        : icon && iconPosition === "right"
          ? size === "sm"
            ? "pr-8"
            : "pr-10"
          : "";

    return (
      <div className={clsx("relative", fullWidth ? "w-full" : "w-auto")}>
        <div
          className={clsx(
            baseClasses,
            focusClasses,
            errorClasses,
            disabledClasses,
            className,
          )}
        >
          {icon && iconPosition === "left" && (
            <span
              className={clsx(
                "pointer-events-none absolute left-2.5 flex items-center justify-center text-[var(--text-tertiary)]",
                size === "sm" ? "h-4 w-4" : "h-5 w-5",
              )}
            >
              {icon}
            </span>
          )}

          <input
            ref={ref}
            disabled={disabled}
            className={clsx(
              "input-inner w-full border-none bg-transparent p-0",
              sizeClasses,
              iconPaddingClasses,
            )}
            aria-invalid={!!error}
            aria-errormessage={error ? `${props.id}-error` : undefined}
            {...props}
          />

          {icon && iconPosition === "right" && (
            <span
              className={clsx(
                "pointer-events-none absolute right-2.5 flex items-center justify-center text-[var(--text-tertiary)]",
                size === "sm" ? "h-4 w-4" : "h-5 w-5",
              )}
            >
              {icon}
            </span>
          )}
        </div>

        {error && (
          <p
            id={`${props.id}-error`}
            className="mt-1.5 text-xs font-medium text-red-500"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
