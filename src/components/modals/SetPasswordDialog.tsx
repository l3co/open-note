import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Key, ShieldAlert } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { usePageStore } from "@/stores/usePageStore";

type Mode = "set" | "change" | "remove";

interface SetPasswordDialogProps {
  pageId: string;
  mode: Mode;
  open: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SetPasswordDialog({
  pageId,
  mode,
  open,
  onSuccess,
  onCancel,
}: SetPasswordDialogProps) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setPagePassword, removePagePassword, changePagePassword } =
    usePageStore();
  const { t } = useTranslation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode !== "remove") {
      if (newPassword !== confirmPassword) {
        setError(t("page.password.passwordMismatch"));
        return;
      }
      if (newPassword.length < 6) {
        setError(t("page.password.tooShort"));
        return;
      }
    } else if (!oldPassword) {
      setError(t("page.password.placeholder"));
      return;
    }

    setLoading(true);
    try {
      if (mode === "set") {
        await setPagePassword(pageId, newPassword);
      } else if (mode === "remove") {
        await removePagePassword(pageId, oldPassword);
      } else {
        await changePagePassword(pageId, oldPassword, newPassword);
      }
      onSuccess();
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

  const titles = {
    set: t("page.password.setTitle"),
    change: t("page.password.changeTitle"),
    remove: t("page.password.removeTitle"),
  };

  const Icon = mode === "remove" ? ShieldAlert : mode === "change" ? Key : Lock;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={titles[mode]}
      description={
        mode === "remove"
          ? t("page.password.removeWarning")
          : t("page.password.forgotWarning")
      }
    >
      <form onSubmit={handleSubmit}>
        <Dialog.Body>
          <div className="flex flex-col gap-4 py-2">
            <div className="mx-auto rounded-full bg-[var(--accent-subtle)] p-3 text-[var(--accent)]">
              <Icon size={24} />
            </div>

            {(mode === "change" || mode === "remove") && (
              <div className="space-y-1">
                <label className="ml-1 text-[11px] font-bold tracking-wider text-[var(--text-tertiary)] uppercase">
                  {t("page.password.currentPassword")}
                </label>
                <Input
                  type="password"
                  placeholder={t("page.password.placeholder")}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  autoFocus={mode === "change" || mode === "remove"}
                  disabled={loading}
                  fullWidth
                />
              </div>
            )}

            {mode !== "remove" && (
              <>
                <div className="space-y-1">
                  <label className="ml-1 text-[11px] font-bold tracking-wider text-[var(--text-tertiary)] uppercase">
                    {t("page.password.newPassword")}
                  </label>
                  <Input
                    type="password"
                    placeholder={t("page.password.newPassword")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus={mode === "set"}
                    disabled={loading}
                    fullWidth
                  />
                </div>
                <div className="space-y-1">
                  <label className="ml-1 text-[11px] font-bold tracking-wider text-[var(--text-tertiary)] uppercase">
                    {t("page.password.confirmPassword")}
                  </label>
                  <Input
                    type="password"
                    placeholder={t("page.password.confirmPassword")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    fullWidth
                  />
                </div>
              </>
            )}

            {error && (
              <p className="mt-1 px-1 text-xs font-medium text-red-500">
                {error}
              </p>
            )}
          </div>
        </Dialog.Body>

        <Dialog.Footer>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            variant={mode === "remove" ? "danger" : "primary"}
            loading={loading}
          >
            {t("common.confirm")}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog>
  );
}
