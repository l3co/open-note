import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Trash2, FolderSync, Settings } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { CreateDialog } from "@/components/shared/CreateDialog";

export function SidebarFooter() {
  const { openWorkspacePicker, openTrashPanel, openSettings } = useUIStore();
  const { createNotebook } = useWorkspaceStore();
  const [showCreate, setShowCreate] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <div
        className="flex items-center justify-between border-t px-2 py-2"
        style={{ borderColor: "var(--border)" }}
        data-testid="sidebar-footer"
      >
        <div className="flex items-center gap-1">
          <FooterButton
            icon={<Plus size={16} />}
            label={t("notebook.new")}
            onClick={() => setShowCreate(true)}
          />
          <FooterButton
            icon={<Search size={16} />}
            label={t("sidebar.search")}
            onClick={() => {}}
            disabled
          />
          <FooterButton
            icon={<Trash2 size={16} />}
            label={t("sidebar.trash")}
            onClick={openTrashPanel}
          />
          <FooterButton
            icon={<Settings size={16} />}
            label={t("settings.title")}
            onClick={openSettings}
          />
        </div>
        <FooterButton
          icon={<FolderSync size={16} />}
          label={t("workspace.open")}
          onClick={openWorkspacePicker}
        />
      </div>

      {showCreate && (
        <CreateDialog
          title={t("notebook.new")}
          placeholder={t("notebook.name_placeholder")}
          onConfirm={async (name) => {
            await createNotebook(name);
            setShowCreate(false);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </>
  );
}

function FooterButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded disabled:opacity-30"
      style={{ color: "var(--text-secondary)" }}
      onMouseEnter={(e) => {
        if (!disabled)
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
      }}
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "transparent")
      }
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
