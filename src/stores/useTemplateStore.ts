import { create } from "zustand";
import type { TemplateSummary } from "@/types/bindings/TemplateSummary";
import type { TemplateCategory } from "@/types/bindings/TemplateCategory";
import type { Page } from "@/types/bindings/Page";
import type { PageId } from "@/types/bindings/PageId";
import type { SectionId } from "@/types/bindings/SectionId";
import type { TemplateId } from "@/types/bindings/TemplateId";
import {
  listTemplates,
  createTemplateFromPage,
  deleteTemplate,
  createPageFromTemplate,
  createPage,
  updatePageBlocks,
} from "@/lib/ipc";
import {
  resolveTemplateTitle,
  type BuiltinTemplate,
} from "@/lib/builtinTemplates";

interface TemplateStore {
  userTemplates: TemplateSummary[];
  isLoading: boolean;
  error: string | null;

  loadUserTemplates: (workspaceId?: string) => Promise<void>;
  createFromPage: (
    pageId: PageId,
    name: string,
    description: string | null,
    category: TemplateCategory,
    workspaceId?: string,
  ) => Promise<TemplateSummary>;
  deleteUserTemplate: (
    templateId: TemplateId,
    workspaceId?: string,
  ) => Promise<void>;
  applyUserTemplate: (
    sectionId: SectionId,
    templateId: TemplateId,
    customTitle?: string,
    workspaceId?: string,
  ) => Promise<Page>;
  applyBuiltinTemplate: (
    sectionId: SectionId,
    template: BuiltinTemplate,
    customTitle?: string,
    workspaceId?: string,
  ) => Promise<Page>;
}

export const useTemplateStore = create<TemplateStore>((set) => ({
  userTemplates: [],
  isLoading: false,
  error: null,

  loadUserTemplates: async (workspaceId) => {
    set({ isLoading: true, error: null });
    try {
      const templates = await listTemplates(workspaceId);
      set({ userTemplates: templates, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  createFromPage: async (pageId, name, description, category, workspaceId) => {
    try {
      const template = await createTemplateFromPage(
        pageId,
        name,
        description,
        category,
        workspaceId,
      );
      set((state) => ({ userTemplates: [template, ...state.userTemplates] }));
      return template;
    } catch (err) {
      set({ error: String(err) });
      throw err;
    }
  },

  deleteUserTemplate: async (templateId, workspaceId) => {
    try {
      await deleteTemplate(templateId, workspaceId);
      set((state) => ({
        userTemplates: state.userTemplates.filter((t) => t.id !== templateId),
      }));
    } catch (err) {
      set({ error: String(err) });
      throw err;
    }
  },

  applyUserTemplate: async (
    sectionId,
    templateId,
    customTitle,
    workspaceId,
  ) => {
    try {
      const page = await createPageFromTemplate(
        sectionId,
        templateId,
        customTitle ?? null,
        workspaceId,
      );
      return page;
    } catch (err) {
      set({ error: String(err) });
      throw err;
    }
  },

  applyBuiltinTemplate: async (
    sectionId,
    template,
    customTitle,
    workspaceId,
  ) => {
    try {
      const title =
        customTitle?.trim() || resolveTemplateTitle(template.titleTemplate);
      const page = await createPage(sectionId, title, workspaceId);
      if (template.blocks.length > 0) {
        // O IPC updatePageBlocks retorna a Page atualizada
        return await updatePageBlocks(page.id, template.blocks, workspaceId);
      }
      return page;
    } catch (err) {
      set({ error: String(err) });
      throw err;
    }
  },
}));
