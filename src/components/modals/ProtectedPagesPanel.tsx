import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, FileText, ExternalLink } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { PasswordUnlockDialog } from "./PasswordUnlockDialog";
import type { PageSummary } from "@/types/bindings/PageSummary";
import type { Page } from "@/types/bindings/Page";

interface ProtectedPagesPanelProps {
  summaries: PageSummary[];
  open: boolean;
  onClose: () => void;
  onNavigate: (pageId: string) => void;
}

export function ProtectedPagesPanel({
  summaries,
  open,
  onClose,
  onNavigate,
}: ProtectedPagesPanelProps) {
  const protectedPages = summaries.filter((s) => s.is_protected);
  const [unlockingPageId, setUnlockingPageId] = useState<string | null>(null);
  const [revealedTitles, setRevealedTitles] = useState<Record<string, string>>(
    {},
  );
  const { t } = useTranslation();

  const handleUnlockSuccess = (page: Page) => {
    setRevealedTitles((prev) => ({ ...prev, [page.id]: page.title }));
    setUnlockingPageId(null);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={t("section.protectedPages.title")}
        description={t("section.protectedPages.description")}
        size="lg"
      >
        <Dialog.Body>
          <div className="grid grid-cols-1 gap-3 py-2">
            {protectedPages.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed bg-[var(--bg-secondary)] py-12 text-center opacity-50">
                <FileText className="mx-auto mb-3 h-10 w-10 text-[var(--text-tertiary)]" />
                <p className="text-sm text-[var(--text-secondary)]">
                  {t("sidebar.no_pages")}
                </p>
              </div>
            ) : (
              protectedPages.map((page) => {
                const isUnlocked = !!revealedTitles[page.id];
                return (
                  <div
                    key={page.id}
                    className="group flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 transition-all hover:border-[var(--accent)]"
                  >
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-2.5 shadow-sm transition-colors group-hover:text-[var(--accent)]">
                        {isUnlocked ? (
                          <FileText className="h-5 w-5" />
                        ) : (
                          <Lock className="h-5 w-5" />
                        )}
                      </div>
                      <span
                        className={`truncate text-sm ${
                          !isUnlocked
                            ? "text-[var(--text-tertiary)] italic"
                            : "font-semibold text-[var(--text-primary)]"
                        }`}
                      >
                        {revealedTitles[page.id] ?? t("page.protected")}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {isUnlocked ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            onNavigate(page.id);
                            onClose();
                          }}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {t("common.ok")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setUnlockingPageId(page.id)}
                        >
                          {t("page.password.unlock")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" onClick={onClose}>
            {t("common.close")}
          </Button>
        </Dialog.Footer>
      </Dialog>

      {unlockingPageId && (
        <PasswordUnlockDialog
          pageId={unlockingPageId}
          open={true}
          onSuccess={handleUnlockSuccess}
          onCancel={() => setUnlockingPageId(null)}
        />
      )}
    </>
  );
}
