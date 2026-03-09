import React, { useEffect, useRef } from "react";
import { clsx } from "clsx";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

export interface DialogProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    size?: "sm" | "md" | "lg" | "xl";
    children: React.ReactNode;
    showCloseButton?: boolean;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    className?: string;
    "data-testid"?: string;
}

export const Dialog = ({
    open,
    onClose,
    title,
    description,
    size = "md",
    children,
    showCloseButton = true,
    closeOnBackdrop = true,
    closeOnEscape = true,
    className,
    "data-testid": dataTestId,
}: DialogProps) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    // Focus trap & Escape handler
    useEffect(() => {
        if (!open) return;

        // Save previous focus
        previousFocusRef.current = document.activeElement as HTMLElement;

        // Prevent body scroll
        document.body.style.overflow = "hidden";

        const handleKeyDown = (e: KeyboardEvent) => {
            // Escape
            if (e.key === "Escape" && closeOnEscape) {
                e.preventDefault();
                onClose();
                return;
            }

            // Focus trap (Tab)
            if (e.key === "Tab" && dialogRef.current) {
                const focusableElements = dialogRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                ) as NodeListOf<HTMLElement>;

                if (focusableElements.length === 0) {
                    e.preventDefault();
                    return;
                }

                const firstElement = focusableElements[0] as HTMLElement;
                const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        // Initial focus after a small delay to ensure DOM is ready
        const timerId = setTimeout(() => {
            if (dialogRef.current) {
                // Check if an element inside the dialog is already focused
                if (dialogRef.current.contains(document.activeElement)) {
                    return;
                }
                const focusableElements = dialogRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                ) as NodeListOf<HTMLElement>;
                if (focusableElements.length > 0) {
                    (focusableElements[0] as HTMLElement).focus();
                } else {
                    dialogRef.current.focus();
                }
            }
        }, 10);

        return () => {
            clearTimeout(timerId);
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";

            // Restore focus
            if (previousFocusRef.current) {
                previousFocusRef.current.focus();
            }
        };
    }, [open, onClose, closeOnEscape]);

    if (!open) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && closeOnBackdrop) {
            onClose();
        }
    };

    const sizeClasses = {
        sm: "max-w-xs w-full",
        md: "max-w-[420px] w-full",
        lg: "max-w-[720px] w-full",
        xl: "max-w-[900px] w-full",
    }[size];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={handleBackdropClick}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? "dialog-title" : undefined}
                aria-describedby={description ? "dialog-description" : undefined}
                tabIndex={-1}
                className={clsx(
                    "bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 relative outline-none",
                    sizeClasses,
                    className
                )}
                onClick={(e) => e.stopPropagation()} // Prevent bubbling to backdrop
                data-testid={dataTestId}
            >
                {showCloseButton && (
                    <div className="absolute top-4 right-4 z-10">
                        <IconButton icon={<X />} onClick={onClose} size="sm" aria-label="Close dialog" />
                    </div>
                )}

                {(title || description) && (
                    <Dialog.Header>
                        {title && (
                            <h2 id="dialog-title" className="text-lg font-semibold text-[var(--text-primary)]">
                                {title}
                            </h2>
                        )}
                        {description && (
                            <p id="dialog-description" className="text-sm text-[var(--text-secondary)] mt-1">
                                {description}
                            </p>
                        )}
                    </Dialog.Header>
                )}

                {children}
            </div>
        </div>
    );
};

export const DialogHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={clsx("px-6 py-4 border-b border-[var(--border-subtle)]", className)}>
        {children}
    </div>
);

export const DialogBody = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={clsx("px-6 py-4 max-h-[70vh] overflow-y-auto", className)}>
        {children}
    </div>
);

export const DialogFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={clsx("px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center justify-end gap-2", className)}>
        {children}
    </div>
);

Dialog.Header = DialogHeader;
Dialog.Body = DialogBody;
Dialog.Footer = DialogFooter;
