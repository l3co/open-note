import React from "react";
import { clsx } from "clsx";

export interface InteractiveCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Cor de destaque do card. Afeta border no hover e barra inferior. */
  accentColor?: string;
  /** Exibe barra colorida na parte inferior do card. */
  accentBar?: boolean;
  children: React.ReactNode;
}

/**
 * Card clicável reutilizável com hover/focus via CSS (.card-interactive).
 * Use `accentColor` para customizar a cor de destaque individual.
 * Use `accentBar` para exibir a barra colorida na base.
 */
export function InteractiveCard({
  accentColor,
  accentBar = false,
  children,
  className,
  style,
  ...props
}: InteractiveCardProps) {
  return (
    <button
      type="button"
      className={clsx("card-interactive text-left", className)}
      data-accent-bar={accentBar ? "true" : undefined}
      style={
        accentColor
          ? ({ "--card-accent": accentColor, ...style } as React.CSSProperties)
          : style
      }
      {...props}
    >
      {children}
    </button>
  );
}
