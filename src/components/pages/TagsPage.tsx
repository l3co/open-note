import { useTranslation } from "react-i18next";
import { Tag } from "lucide-react";
import { BackgroundPattern } from "@/components/shared/BackgroundPattern";

export function TagsPage() {
  const { t } = useTranslation();

  return (
    <div
      className="relative flex flex-1 items-center justify-center"
      style={{ backgroundColor: "var(--bg-primary)" }}
      data-testid="tags-page"
    >
      <BackgroundPattern />
      <div className="relative z-10 text-center">
        <Tag
          size={40}
          className="mx-auto mb-4 opacity-30"
          style={{ color: "var(--text-tertiary)" }}
        />
        <h2
          className="text-lg font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {t("sidebar.tags")}
        </h2>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--text-tertiary)" }}
        >
          {t("sidebar.calendar_coming_soon")}
        </p>
      </div>
    </div>
  );
}
