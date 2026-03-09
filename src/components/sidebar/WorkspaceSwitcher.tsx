import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check, X, FolderOpen, Plus } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useWorkspaceList } from "@/hooks/useWorkspaceList";
import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";

interface WorkspaceSwitcherProps {
  onOpenWorkspacePicker?: () => void;
}

export function WorkspaceSwitcher({
  onOpenWorkspacePicker,
}: WorkspaceSwitcherProps) {
  const { workspaces, focusedId } = useWorkspaceList();
  const { focusWorkspace, closeWorkspace, openWorkspace } =
    useMultiWorkspaceStore.getState();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const focused = workspaces.find((w) => w.workspace.id === focusedId);

  const handleToggle = () => setIsOpen((v) => !v);

  const handleFocus = (id: string) => {
    if (id !== focusedId) focusWorkspace(id);
    setIsOpen(false);
  };

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmClose(id);
  };

  const confirmCloseWorkspace = async (id: string) => {
    await closeWorkspace(id);
    setConfirmClose(null);
  };

  const handleOpenNew = async () => {
    setIsOpen(false);
    if (onOpenWorkspacePicker) {
      onOpenWorkspacePicker();
      return;
    }
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: t("workspace.open_another"),
    });
    if (selected) await openWorkspace(selected as string);
  };

  const handleCreateNew = () => {
    setIsOpen(false);
    if (onOpenWorkspacePicker) onOpenWorkspacePicker();
  };

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setConfirmClose(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setConfirmClose(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  return (
    <div className="relative px-3 pt-3 pb-2" data-testid="workspace-switcher">
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium"
        style={{ color: "var(--text-primary)" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={focused?.workspace.root_path}
        data-testid="workspace-switcher-trigger"
      >
        <FolderOpen
          size={15}
          style={{ color: "var(--accent)", flexShrink: 0 }}
        />
        <span
          className="flex-1 truncate text-left"
          data-testid="workspace-switcher-name"
        >
          {focused?.workspace.name ?? t("workspace.none_open")}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: "var(--text-tertiary)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
            flexShrink: 0,
          }}
        />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="listbox"
          aria-label={t("workspace.switcher_title")}
          className="absolute top-full right-3 left-3 z-50 mt-1 rounded-lg border py-1 shadow-lg"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-lg)",
          }}
          data-testid="workspace-switcher-popover"
        >
          {workspaces.map((slice) => {
            const id = slice.workspace.id;
            const isFocused = id === focusedId;

            if (confirmClose === id) {
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 px-3 py-2 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span className="flex-1 truncate">
                    {t("workspace.close_confirm", {
                      name: slice.workspace.name,
                    })}
                  </span>
                  <button
                    onClick={() => setConfirmClose(null)}
                    className="rounded px-2 py-0.5 text-xs"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={() => confirmCloseWorkspace(id)}
                    className="rounded px-2 py-0.5 text-xs font-medium"
                    style={{ color: "var(--danger)" }}
                    data-testid={`workspace-close-confirm-${id}`}
                  >
                    {t("workspace.close_workspace")}
                  </button>
                </div>
              );
            }

            return (
              <button
                key={id}
                role="option"
                aria-selected={isFocused}
                onClick={() => handleFocus(id)}
                className="group flex w-full items-center gap-2 px-3 py-2 text-sm"
                style={{ color: "var(--text-primary)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
                title={t("workspace.switch_to", { name: slice.workspace.name })}
                data-testid={`workspace-item-${id}`}
              >
                <span
                  className="w-4 shrink-0"
                  style={{ color: "var(--accent)" }}
                >
                  {isFocused && <Check size={14} />}
                </span>
                <span className="flex-1 truncate text-left">
                  {slice.workspace.name}
                </span>
                <span
                  className="truncate text-xs opacity-50"
                  style={{ maxWidth: "6rem", color: "var(--text-tertiary)" }}
                  title={slice.workspace.root_path}
                >
                  {slice.workspace.root_path.split("/").pop()}
                </span>
                <button
                  onClick={(e) => handleClose(e, id)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100"
                  style={{ color: "var(--text-tertiary)" }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    e.currentTarget.style.backgroundColor = "var(--bg-active)";
                  }}
                  onMouseLeave={(e) => {
                    e.stopPropagation();
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                  aria-label={t("workspace.close_workspace")}
                  data-testid={`workspace-close-${id}`}
                >
                  <X size={12} />
                </button>
              </button>
            );
          })}

          <div
            className="my-1 border-t"
            style={{ borderColor: "var(--border)" }}
          />

          <button
            onClick={handleOpenNew}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            data-testid="workspace-open-another"
          >
            <FolderOpen size={14} />
            {t("workspace.open_another")}
          </button>
          <button
            onClick={handleCreateNew}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            data-testid="workspace-create-another"
          >
            <Plus size={14} />
            {t("workspace.create_another")}
          </button>
        </div>
      )}
    </div>
  );
}
