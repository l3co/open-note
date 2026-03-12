import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTemplateStore } from "@/stores/useTemplateStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import {
  BUILTIN_TEMPLATES,
  resolveTemplateTitle,
  type BuiltinTemplate,
} from "@/lib/builtinTemplates";
import type { SectionId } from "@/types/bindings/SectionId";
import type { Page } from "@/types/bindings/Page";
import type { TemplateSummary } from "@/types/bindings/TemplateSummary";
import { Search, SearchX, Check, LayoutTemplate, Sparkles } from "lucide-react";
import { clsx } from "clsx";

interface Props {
  open: boolean;
  onClose: () => void;
  sectionId: SectionId;
  onPageCreated: (page: Page) => void;
}

export function TemplatePickerModal({
  open,
  onClose,
  sectionId,
  onPageCreated,
}: Props) {
  const { t } = useTranslation();
  const {
    userTemplates,
    loadUserTemplates,
    applyUserTemplate,
    applyBuiltinTemplate,
  } = useTemplateStore();
  const { workspace } = useWorkspaceStore();

  const [selectedBuiltin, setSelectedBuiltin] =
    useState<BuiltinTemplate | null>(null);
  const [selectedUser, setSelectedUser] = useState<TemplateSummary | null>(
    null,
  );
  const [customTitle, setCustomTitle] = useState("");
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadUserTemplates(workspace?.id);
      // Default selection
      const blank = BUILTIN_TEMPLATES.find((t) => t.id === "builtin-blank");
      if (blank) {
        handleSelectBuiltin(blank);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSelectBuiltin = (template: BuiltinTemplate) => {
    setSelectedBuiltin(template);
    setSelectedUser(null);
    setCustomTitle(resolveTemplateTitle(template.titleTemplate));
    setError(null);
  };

  const handleSelectUser = (template: TemplateSummary) => {
    setSelectedUser(template);
    setSelectedBuiltin(null);
    setCustomTitle(resolveTemplateTitle(template.title_template));
    setError(null);
  };

  const filteredBuiltins = useMemo(
    () =>
      BUILTIN_TEMPLATES.filter(
        (t) =>
          (t.id !== "builtin-blank" &&
            t.name.toLowerCase().includes(search.toLowerCase())) ||
          t.category.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  const filteredUserTemplates = useMemo(
    () =>
      userTemplates.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.category.toLowerCase().includes(search.toLowerCase()),
      ),
    [userTemplates, search],
  );

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);
    try {
      let page: Page;
      if (selectedBuiltin) {
        page = await applyBuiltinTemplate(
          sectionId,
          selectedBuiltin,
          customTitle,
          workspace?.id,
        );
      } else if (selectedUser) {
        page = await applyUserTemplate(
          sectionId,
          selectedUser.id,
          customTitle,
          workspace?.id,
        );
      } else {
        return;
      }
      onPageCreated(page);
      onClose();
    } catch {
      setError(t("templates.errors.apply_failed"));
    } finally {
      setIsCreating(false);
    }
  };

  const blankTemplate = BUILTIN_TEMPLATES.find(
    (t) => t.id === "builtin-blank",
  )!;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title={t("templates.title")}
    >
      <DialogHeader>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <LayoutTemplate className="h-5 w-5 text-[var(--accent)]" />
            {t("templates.title")}
          </h2>
        </div>
        <div className="relative mt-4">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search.panel_placeholder")}
            className="pl-10"
            autoFocus
          />
        </div>
      </DialogHeader>

      <DialogBody className="min-h-[200px]">
        <div className="space-y-5">
          {/* Seção Em Branco (Sempre Visível se não houver busca ativa ou se bater na busca) */}
          {(!search ||
            blankTemplate.name
              .toLowerCase()
              .includes(search.toLowerCase())) && (
            <div className="space-y-3">
              <div
                onClick={() => handleSelectBuiltin(blankTemplate)}
                className={clsx(
                  "group flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-all",
                  selectedBuiltin?.id === blankTemplate.id
                    ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-md"
                    : "border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--border-strong)]",
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-lg shadow-sm">
                  {blankTemplate.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[var(--text-primary)]">
                    {t(blankTemplate.name)}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {t(blankTemplate.descriptionKey)}
                  </p>
                </div>
                {selectedBuiltin?.id === blankTemplate.id && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                    <Check className="h-4 w-4 stroke-[3]" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Seção Built-ins */}
          {filteredBuiltins.length > 0 && (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-[var(--text-tertiary)] uppercase">
                <Sparkles className="h-3 w-3" />
                {t("templates.title")}
              </h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {filteredBuiltins.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    icon={tpl.icon}
                    name={t(tpl.name)}
                    description={t(tpl.descriptionKey)}
                    category={t(`templates.category.${tpl.category}`)}
                    selected={selectedBuiltin?.id === tpl.id}
                    onClick={() => handleSelectBuiltin(tpl)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Seção Usuário */}
          {filteredUserTemplates.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold tracking-wider text-[var(--text-tertiary)] uppercase">
                {t("templates.actions.use_template")}
              </h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {filteredUserTemplates.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    icon={tpl.icon || "📄"}
                    name={tpl.name}
                    description={tpl.description || ""}
                    category={t(`templates.category.${tpl.category}`)}
                    selected={selectedUser?.id === tpl.id}
                    onClick={() => handleSelectUser(tpl)}
                  />
                ))}
              </div>
            </div>
          )}

          {search &&
            filteredBuiltins.length === 0 &&
            filteredUserTemplates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-[var(--text-secondary)]">
                <SearchX className="mb-4 h-12 w-12 opacity-20" />
                <p>{t("search.no_results")}</p>
              </div>
            )}
        </div>
      </DialogBody>

      <DialogFooter className="flex-col !items-stretch gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold tracking-tight text-[var(--text-secondary)] uppercase">
            {t("page.untitled")}
          </label>
          <Input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="..."
            className="bg-[var(--bg-primary)]"
          />
        </div>

        {error && <p className="text-sm font-medium text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isCreating}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            loading={isCreating}
            disabled={
              (!selectedBuiltin && !selectedUser) || !customTitle.trim()
            }
          >
            {t("common.create")}
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  );
}

interface TemplateCardProps {
  icon: string;
  name: string;
  description: string;
  category: string;
  selected: boolean;
  onClick: () => void;
}

function TemplateCard({
  icon,
  name,
  description,
  category,
  selected,
  onClick,
}: TemplateCardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border-2 p-2.5 transition-all",
        selected
          ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-sm"
          : "border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--border-strong)]",
      )}
    >
      <div className="mb-1.5 flex items-start justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-base shadow-sm">
          {icon}
        </div>
        <span className="rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[10px] font-bold tracking-widest text-[var(--text-tertiary)] uppercase">
          {category}
        </span>
      </div>
      <h4 className="mb-1 leading-tight font-bold text-[var(--text-primary)]">
        {name}
      </h4>
      <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
        {description}
      </p>

      {selected && (
        <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-white">
          <Check className="h-3 w-3 stroke-[3]" />
        </div>
      )}
    </div>
  );
}
