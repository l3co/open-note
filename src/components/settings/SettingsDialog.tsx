import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Settings,
  Palette,
  Type,
  Cloud,
  Keyboard,
  Info,
} from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { GeneralSection } from "@/components/settings/GeneralSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { EditorSection } from "@/components/settings/EditorSection";
import { SyncSection } from "@/components/settings/SyncSection";
import { ShortcutsSection } from "@/components/settings/ShortcutsSection";
import { AboutSection } from "@/components/settings/AboutSection";
import { Dialog, IconButton } from "@/components/ui";
import { clsx } from "clsx";

type SettingsTab =
  | "general"
  | "appearance"
  | "editor"
  | "sync"
  | "shortcuts"
  | "about";

export function SettingsDialog() {
  const show = useUIStore((s) => s.showSettings);
  const close = useUIStore((s) => s.closeSettings);
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  if (!show) return null;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "general",
      label: t("settings.general"),
      icon: <Settings size={16} />,
    },
    {
      id: "appearance",
      label: t("settings.appearance"),
      icon: <Palette size={16} />,
    },
    {
      id: "editor",
      label: t("settings.editor_section"),
      icon: <Type size={16} />,
    },
    {
      id: "sync",
      label: t("settings.sync_section"),
      icon: <Cloud size={16} />,
    },
    {
      id: "shortcuts",
      label: t("settings.shortcuts"),
      icon: <Keyboard size={16} />,
    },
    { id: "about", label: t("settings.about"), icon: <Info size={16} /> },
  ];

  return (
    <Dialog
      open={show}
      onClose={close}
      size="lg"
      showCloseButton={false}
      data-testid="settings-dialog"
    >
      <div className="flex h-[560px] w-full overflow-hidden">
        {/* Sidebar */}
        <div
          className="flex w-[200px] flex-shrink-0 flex-col border-r py-4"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border)",
          }}
        >
          <h2
            className="mb-4 px-4 text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {t("settings.title")}
          </h2>
          <nav className="flex flex-col gap-0.5 px-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`settings-tab-${tab.id}`}
                className={clsx(
                  "interactive-ghost flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition-colors",
                  activeTab !== tab.id && "text-[var(--text-secondary)]",
                )}
                data-active={activeTab === tab.id}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col">
          <div
            className="flex items-center justify-between border-b px-6 py-3"
            style={{ borderColor: "var(--border)" }}
          >
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {tabs.find((t) => t.id === activeTab)?.label}
            </h3>
            <IconButton
              size="sm"
              icon={<X size={14} />}
              onClick={close}
              aria-label={t("common.close")}
            />
          </div>

          <div
            className="flex-1 overflow-y-auto px-6 py-4"
            data-testid="settings-content"
          >
            {activeTab === "general" && <GeneralSection />}
            {activeTab === "appearance" && <AppearanceSection />}
            {activeTab === "editor" && <EditorSection />}
            {activeTab === "sync" && <SyncSection />}
            {activeTab === "shortcuts" && <ShortcutsSection />}
            {activeTab === "about" && <AboutSection />}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
