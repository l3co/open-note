import { invoke } from "@tauri-apps/api/core";
import type { AppState } from "@/types/bindings/AppState";
import type { GlobalSettings } from "@/types/bindings/GlobalSettings";
import type { Notebook } from "@/types/bindings/Notebook";
import type { NotebookId } from "@/types/bindings/NotebookId";
import type { Block } from "@/types/bindings/Block";
import type { Page } from "@/types/bindings/Page";
import type { PageId } from "@/types/bindings/PageId";
import type { PageSummary } from "@/types/bindings/PageSummary";
import type { Section } from "@/types/bindings/Section";
import type { SectionId } from "@/types/bindings/SectionId";
import type { TrashItem } from "@/types/bindings/TrashItem";
import type { Workspace } from "@/types/bindings/Workspace";
import type { WorkspaceSettings } from "@/types/bindings/WorkspaceSettings";

// ─── App ───

export const getAppState = () => invoke<AppState>("get_app_state");

// ─── Workspace ───

export const createWorkspace = (path: string, name: string) =>
  invoke<Workspace>("create_workspace", { path, name });

export const openWorkspace = (path: string) =>
  invoke<Workspace>("open_workspace", { path });

export const closeWorkspace = () => invoke<void>("close_workspace");

export const removeRecentWorkspace = (path: string) =>
  invoke<void>("remove_recent_workspace", { path });

export const getWorkspaceSettings = () =>
  invoke<WorkspaceSettings>("get_workspace_settings");

export const updateWorkspaceSettings = (settings: WorkspaceSettings) =>
  invoke<void>("update_workspace_settings", { settings });

export const getGlobalSettings = () =>
  invoke<GlobalSettings>("get_global_settings");

export const updateGlobalSettings = (settings: GlobalSettings) =>
  invoke<void>("update_global_settings", { settings });

// ─── Notebook ───

export const listNotebooks = () => invoke<Notebook[]>("list_notebooks");

export const createNotebook = (name: string) =>
  invoke<Notebook>("create_notebook", { name });

export const renameNotebook = (id: NotebookId, name: string) =>
  invoke<Notebook>("rename_notebook", { id, name });

export const deleteNotebook = (id: NotebookId) =>
  invoke<void>("delete_notebook", { id });

export const reorderNotebooks = (order: [NotebookId, number][]) =>
  invoke<void>("reorder_notebooks", { order });

// ─── Section ───

export const listSections = (notebookId: NotebookId) =>
  invoke<Section[]>("list_sections", { notebookId });

export const createSection = (notebookId: NotebookId, name: string) =>
  invoke<Section>("create_section", { notebookId, name });

export const renameSection = (id: SectionId, name: string) =>
  invoke<Section>("rename_section", { id, name });

export const deleteSection = (id: SectionId) =>
  invoke<void>("delete_section", { id });

export const reorderSections = (order: [SectionId, number][]) =>
  invoke<void>("reorder_sections", { order });

// ─── Page ───

export const listPages = (sectionId: SectionId) =>
  invoke<PageSummary[]>("list_pages", { sectionId });

export const loadPage = (pageId: PageId) =>
  invoke<Page>("load_page", { pageId });

export const createPage = (sectionId: SectionId, title: string) =>
  invoke<Page>("create_page", { sectionId, title });

export const updatePage = (page: Page) =>
  invoke<void>("update_page", { page });

export const updatePageBlocks = (pageId: PageId, blocks: Block[]) =>
  invoke<Page>("update_page_blocks", { pageId, blocks });

export const deletePage = (pageId: PageId) =>
  invoke<void>("delete_page", { pageId });

export const movePage = (pageId: PageId, targetSectionId: SectionId) =>
  invoke<Page>("move_page", { pageId, targetSectionId });

// ─── File I/O ───

export const readFileContent = (path: string) =>
  invoke<string>("read_file_content", { path });

export const saveFileContent = (path: string, content: string) =>
  invoke<void>("save_file_content", { path, content });

// ─── Tags ───

export const listAllTags = () => invoke<string[]>("list_all_tags");

// ─── Trash ───

export const listTrashItems = () => invoke<TrashItem[]>("list_trash_items");

export const restoreFromTrash = (trashItemId: string) =>
  invoke<void>("restore_from_trash", { trashItemId });

export const permanentlyDelete = (trashItemId: string) =>
  invoke<void>("permanently_delete", { trashItemId });

export const emptyTrash = () => invoke<void>("empty_trash");
