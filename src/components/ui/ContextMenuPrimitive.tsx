import React, { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

export interface ContextMenuPrimitiveProps {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
}

export const ContextMenuPrimitive = ({
  x,
  y,
  onClose,
  children,
}: ContextMenuPrimitiveProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: y, left: x });

  useEffect(() => {
    if (!menuRef.current) return;

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    // Adjust if menu overflows right
    if (x + menuRect.width > viewportWidth) {
      adjustedX = x - menuRect.width;
      // If it still overflows left after adjustment, push it to 0
      if (adjustedX < 0) adjustedX = 0;
    }

    // Adjust if menu overflows bottom
    if (y + menuRect.height > viewportHeight) {
      adjustedY = y - menuRect.height;
      // If it still overflows top after adjustment, push it to 0
      if (adjustedY < 0) adjustedY = 0;
    }

    // Set final position
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosition({ top: adjustedY, left: adjustedX });
  }, [x, y, children]); // Re-calculate if children change size

  // Focus and Keyboard Navigation
  useEffect(() => {
    if (!menuRef.current) return;

    // First focus the menu to capture keyboard events
    menuRef.current.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      const menuItems = Array.from(
        menuRef.current?.querySelectorAll(
          '[role="menuitem"]:not([aria-disabled="true"])',
        ) || [],
      ) as HTMLElement[];

      if (menuItems.length === 0) return;

      const currentIndex = menuItems.findIndex(
        (el) => el === document.activeElement,
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % menuItems.length;
        menuItems[nextIndex]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const nextIndex =
          currentIndex <= 0 ? menuItems.length - 1 : currentIndex - 1;
        menuItems[nextIndex]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        menuItems[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        menuItems[menuItems.length - 1]?.focus();
      }
    };

    const handleOutsideClick = (e: MouseEvent) => {
      // Delay closing to prevent immediate close if a click triggered the context menu
      setTimeout(() => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          onClose();
        }
      }, 0);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("contextmenu", handleOutsideClick);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("contextmenu", handleOutsideClick);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      className="fixed z-50 min-w-44 rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-1 text-[var(--text-primary)] shadow-lg outline-none"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, {
          // Pass tabindex so we can focus items programmatically
          tabIndex: index === 0 ? 0 : -1,
        } as React.HTMLAttributes<HTMLElement>);
      })}
    </div>
  );
};

export interface MenuItemProps {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
  tabIndex?: number;
}

export const MenuItem = ({
  icon,
  label,
  onClick,
  danger,
  disabled,
  shortcut,
  tabIndex = -1,
}: MenuItemProps) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!disabled) {
        onClick();
      }
    }
  };

  const baseClasses =
    "flex items-center w-full px-3 py-1.5 text-sm transition-colors outline-none cursor-pointer";

  const stateClasses = disabled
    ? "opacity-50 cursor-not-allowed"
    : danger
      ? "text-red-500 hover:bg-red-500 hover:text-white focus:bg-red-500 focus:text-white"
      : "hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)]";

  return (
    <div
      role="menuitem"
      tabIndex={disabled ? -1 : tabIndex}
      aria-disabled={disabled}
      className={clsx(baseClasses, stateClasses)}
      onClick={() => {
        if (!disabled) onClick();
      }}
      onKeyDown={handleKeyDown}
    >
      {icon && (
        <span className="mr-2.5 flex h-4 w-4 flex-shrink-0 items-center justify-center">
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {shortcut && (
        <span className="ml-4 font-mono text-xs tracking-widest uppercase opacity-60">
          {shortcut}
        </span>
      )}
    </div>
  );
};

export const MenuSeparator = () => (
  <div role="separator" className="my-1 h-px bg-[var(--border-subtle)]" />
);

ContextMenuPrimitive.Separator = MenuSeparator;
ContextMenuPrimitive.Item = MenuItem;
