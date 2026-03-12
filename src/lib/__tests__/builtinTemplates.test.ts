import { describe, it, expect } from "vitest";
import { BUILTIN_TEMPLATES, resolveTemplateTitle } from "../builtinTemplates";

describe("builtinTemplates", () => {
  describe("resolveTemplateTitle", () => {
    it("should replace {{date}} with current date in YYYY-MM-DD format", () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(resolveTemplateTitle("Reunião {{date}}")).toBe(`Reunião ${today}`);
    });

    it("should replace multiple {{date}} occurrences", () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(resolveTemplateTitle("{{date}} - {{date}}")).toBe(
        `${today} - ${today}`,
      );
    });

    it("should return unchanged string if no placeholder is present", () => {
      expect(resolveTemplateTitle("Static Title")).toBe("Static Title");
    });
  });

  describe("BUILTIN_TEMPLATES", () => {
    it("should have unique IDs", () => {
      const ids = BUILTIN_TEMPLATES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should not contain any ImageBlock (requirement v1)", () => {
      for (const template of BUILTIN_TEMPLATES) {
        const hasImage = template.blocks.some((b) => b.type === "image");
        expect(
          hasImage,
          `Template ${template.id} should not have ImageBlock`,
        ).toBe(false);
      }
    });

    it("should have at least one block for non-blank templates", () => {
      const nonBlank = BUILTIN_TEMPLATES.filter(
        (t) => t.id !== "builtin-blank",
      );
      for (const template of nonBlank) {
        expect(template.blocks.length).toBeGreaterThan(0);
      }
    });

    it("all block ids must be valid UUIDs (Rust backend deserializes as uuid::Uuid)", () => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const template of BUILTIN_TEMPLATES) {
        for (const block of template.blocks) {
          const base = block as { id: string };
          expect(
            uuidRegex.test(base.id),
            `Block id "${base.id}" in template "${template.id}" is not a valid UUID`,
          ).toBe(true);
        }
      }
    });
  });
});
