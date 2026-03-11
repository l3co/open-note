import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Clock } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { usePageStore } from "@/stores/usePageStore";
import type { Page } from "@/types/bindings/Page";

interface PasswordUnlockDialogProps {
  pageId: string;
  open: boolean;
  onSuccess: (page: Page) => void;
  onCancel: () => void;
}

type DurationOption = "once" | "10min" | "30min" | "1hour" | "session";

export function PasswordUnlockDialog({
  pageId,
  open,
  onSuccess,
  onCancel,
}: PasswordUnlockDialogProps) {
  const [password, setPassword] = useState("");
  const [duration, setDuration] = useState<DurationOption>("30min");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { unlockPage } = usePageStore();
  const { t } = useTranslation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setError(null);

    let durationMins: number | undefined;
    if (duration === "once")
      durationMins = 0; // Expira quase imediatamente
    else if (duration === "10min") durationMins = 10;
    else if (duration === "30min") durationMins = 30;
    else if (duration === "1hour") durationMins = 60;
    else durationMins = undefined; // Session (até fechar app)

    try {
      await unlockPage(pageId, password, durationMins);
      const { currentPage } = usePageStore.getState();
      if (currentPage) {
        onSuccess(currentPage);
      }
    } catch (err) {
      const msg = String(err);
      if (msg.includes("WRONG_PASSWORD")) {
        setError(t("page.password.wrongPassword"));
      } else {
        setError(t("common.error_generic"));
      }
    } finally {
      setLoading(false);
    }
  };

  const durations: { value: DurationOption; label: string }[] = [
    { value: "once", label: t("page.password.durations.once") },
    { value: "10min", label: t("page.password.durations.10min") },
    { value: "30min", label: t("page.password.durations.30min") },
    { value: "1hour", label: t("page.password.durations.1hour") },
    { value: "session", label: t("page.password.durations.session") },
  ];

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={t("page.password.unlockTitle")}
      description={t("page.password.unlockDescription")}
    >
      <form onSubmit={handleSubmit}>
        <Dialog.Body>
          <div className="flex flex-col gap-6 py-2">
            <div className="mx-auto rounded-full bg-[var(--accent-subtle)] p-4 text-[var(--accent)]">
              <Lock size={32} />
            </div>

            <div className="space-y-4">
              <Input
                type="password"
                placeholder={t("page.password.placeholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                disabled={loading}
                error={error ?? undefined}
                fullWidth
              />

              <div className="space-y-2">
                <div className="ml-1 flex items-center gap-2 text-[11px] font-bold tracking-wider text-[var(--text-tertiary)] uppercase">
                  <Clock size={12} />
                  {t("page.password.remember")}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {durations.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDuration(opt.value)}
                      className={`rounded-md border px-3 py-2 text-left text-xs transition-all ${
                        duration === opt.value
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-sm"
                          : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!password}
          >
            {t("page.password.unlock")}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog>
  );
}
