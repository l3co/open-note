import { invoke } from "@tauri-apps/api/core";
import type { ActiveWorkspace } from "@/types/bindings/ActiveWorkspace";
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
import type { PageAnnotations } from "@/types/bindings/PageAnnotations";
import type { TrashItem } from "@/types/bindings/TrashItem";
import type { Workspace } from "@/types/bindings/Workspace";
import type { WorkspaceSettings } from "@/types/bindings/WorkspaceSettings";
import type { TemplateId } from "@/types/bindings/TemplateId";
import type { TemplateSummary } from "@/types/bindings/TemplateSummary";
import type { TemplateCategory } from "@/types/bindings/TemplateCategory";

// ─── App ───

export const getAppState = () => invoke<AppState>("get_app_state");

// ─── Workspace ───

export const createWorkspace = (path: string, name: string) =>
  invoke<Workspace>("create_workspace", { path, name });

export const openWorkspace = (path: string) =>
  invoke<Workspace>("open_workspace", { path });

/** Force-abre um workspace removendo um lock stale. Chamar somente após confirmar com o usuário. */
export const forceOpenWorkspace = (path: string) =>
  invoke<Workspace>("force_open_workspace", { path });

/** Fecha o workspace em foco ou o especificado por workspaceId. */
export const closeWorkspace = (workspaceId?: string) =>
  invoke<void>("close_workspace", { workspaceId });

/** Lista todos os workspaces atualmente abertos. */
export const listOpenWorkspaces = () =>
  invoke<ActiveWorkspace[]>("list_open_workspaces");

/** Define o workspace em foco sem fechar os demais. */
export const focusWorkspace = (workspaceId: string) =>
  invoke<void>("focus_workspace", { workspaceId });

/** Muda o workspace em foco e retorna seus dados. */
export const switchWorkspace = (workspaceId: string) =>
  invoke<Workspace>("switch_workspace", { workspaceId });

export const removeRecentWorkspace = (path: string) =>
  invoke<void>("remove_recent_workspace", { path });

export const getWorkspaceSettings = (workspaceId?: string) =>
  invoke<WorkspaceSettings>("get_workspace_settings", { workspaceId });

export const updateWorkspaceSettings = (
  settings: WorkspaceSettings,
  workspaceId?: string,
) => invoke<void>("update_workspace_settings", { settings, workspaceId });

export const getGlobalSettings = () =>
  invoke<GlobalSettings>("get_global_settings");

export const updateGlobalSettings = (settings: GlobalSettings) =>
  invoke<void>("update_global_settings", { settings });

// ─── Notebook ───

export const listNotebooks = (workspaceId?: string) =>
  invoke<Notebook[]>("list_notebooks", { workspaceId });

export const createNotebook = (name: string, workspaceId?: string) =>
  invoke<Notebook>("create_notebook", { name, workspaceId });

export const renameNotebook = (
  id: NotebookId,
  name: string,
  workspaceId?: string,
) => invoke<Notebook>("rename_notebook", { id, name, workspaceId });

export const deleteNotebook = (id: NotebookId, workspaceId?: string) =>
  invoke<void>("delete_notebook", { id, workspaceId });

export const reorderNotebooks = (
  order: [NotebookId, number][],
  workspaceId?: string,
) => invoke<void>("reorder_notebooks", { order, workspaceId });

// ─── Section ───

export const listSections = (notebookId: NotebookId, workspaceId?: string) =>
  invoke<Section[]>("list_sections", { notebookId, workspaceId });

export const createSection = (
  notebookId: NotebookId,
  name: string,
  workspaceId?: string,
) => invoke<Section>("create_section", { notebookId, name, workspaceId });

export const renameSection = (
  id: SectionId,
  name: string,
  workspaceId?: string,
) => invoke<Section>("rename_section", { id, name, workspaceId });

export const deleteSection = (id: SectionId, workspaceId?: string) =>
  invoke<void>("delete_section", { id, workspaceId });

export const reorderSections = (
  order: [SectionId, number][],
  workspaceId?: string,
) => invoke<void>("reorder_sections", { order, workspaceId });

// ─── Page ───

export const listPages = (sectionId: SectionId, workspaceId?: string) =>
  invoke<PageSummary[]>("list_pages", { sectionId, workspaceId });

export const loadPage = (pageId: PageId, workspaceId?: string) =>
  invoke<Page>("load_page", { pageId, workspaceId });

export const unlockPage = (
  pageId: PageId,
  password: string,
  durationMins?: number,
  workspaceId?: string,
) =>
  invoke<Page>("unlock_page", { pageId, password, durationMins, workspaceId });

export const lockPage = (pageId: PageId) =>
  invoke<void>("lock_page", { pageId });

export const setPagePassword = (
  pageId: PageId,
  password: string,
  workspaceId?: string,
) => invoke<void>("set_page_password", { pageId, password, workspaceId });

export const removePagePassword = (
  pageId: PageId,
  password: string,
  workspaceId?: string,
) => invoke<Page>("remove_page_password", { pageId, password, workspaceId });

export const changePagePassword = (
  pageId: PageId,
  oldPassword: string,
  newPassword: string,
  workspaceId?: string,
) =>
  invoke<void>("change_page_password", {
    pageId,
    oldPassword,
    newPassword,
    workspaceId,
  });

export const createPage = (
  sectionId: SectionId,
  title: string,
  workspaceId?: string,
) => invoke<Page>("create_page", { sectionId, title, workspaceId });

export const updatePage = (page: Page, workspaceId?: string) =>
  invoke<void>("update_page", { page, workspaceId });

export const updatePageBlocks = (
  pageId: PageId,
  blocks: Block[],
  workspaceId?: string,
) => invoke<Page>("update_page_blocks", { pageId, blocks, workspaceId });

export const deletePage = (pageId: PageId, workspaceId?: string) =>
  invoke<void>("delete_page", { pageId, workspaceId });

export const movePage = (
  pageId: PageId,
  targetSectionId: SectionId,
  workspaceId?: string,
) => invoke<Page>("move_page", { pageId, targetSectionId, workspaceId });

export const moveSection = (
  sectionId: SectionId,
  targetNotebookId: NotebookId,
  workspaceId?: string,
) =>
  invoke<Section>("move_section", { sectionId, targetNotebookId, workspaceId });

// ─── File I/O ───

export const readFileContent = (path: string) =>
  invoke<string>("read_file_content", { path });

export const saveFileContent = (path: string, content: string) =>
  invoke<void>("save_file_content", { path, content });

// ─── Assets ───

export const importAsset = (
  sectionId: SectionId,
  filePath: string,
  workspaceId?: string,
) =>
  invoke<{ asset_path: string; absolute_path: string }>("import_asset", {
    sectionId,
    filePath,
    workspaceId,
  });

export const readAssetBase64 = (filePath: string) =>
  invoke<string>("read_asset_base64", { filePath });

// ─── PDF ───

export const importPdf = (
  sectionId: SectionId,
  filePath: string,
  workspaceId?: string,
) =>
  invoke<[string, string, number]>("import_pdf", {
    sectionId,
    filePath,
    workspaceId,
  });

export const createPdfCanvasPage = (
  sectionId: SectionId,
  title: string,
  pdfAsset: string,
  pdfTotalPages: number,
  workspaceId?: string,
) =>
  invoke<Page>("create_pdf_canvas_page", {
    sectionId,
    title,
    pdfAsset,
    pdfTotalPages,
    workspaceId,
  });

export const updatePageAnnotations = (
  pageId: PageId,
  annotations: PageAnnotations,
  workspaceId?: string,
) =>
  invoke<void>("update_page_annotations", {
    pageId,
    annotations,
    workspaceId,
  });

// ─── Canvas ───

export const createCanvasPage = (
  sectionId: SectionId,
  title: string,
  workspaceId?: string,
) =>
  invoke<Page>("create_canvas_page", {
    sectionId,
    title,
    workspaceId,
  });

export const updatePageCanvasState = (
  pageId: PageId,
  canvasState: unknown | null,
  workspaceId?: string,
) =>
  invoke<void>("update_page_canvas_state", {
    pageId,
    canvasState,
    workspaceId,
  });

// ─── Templates ───

export const listTemplates = (workspaceId?: string) =>
  invoke<TemplateSummary[]>("list_templates", { workspaceId });

export const createTemplateFromPage = (
  pageId: PageId,
  name: string,
  description: string | null,
  category: TemplateCategory,
  workspaceId?: string,
) =>
  invoke<TemplateSummary>("create_template_from_page", {
    pageId,
    name,
    description,
    category,
    workspaceId,
  });

export const deleteTemplate = (templateId: TemplateId, workspaceId?: string) =>
  invoke<void>("delete_template", { templateId, workspaceId });

export const createPageFromTemplate = (
  sectionId: SectionId,
  templateId: TemplateId,
  customTitle: string | null,
  workspaceId?: string,
) =>
  invoke<Page>("create_page_from_template", {
    sectionId,
    templateId,
    customTitle,
    workspaceId,
  });

// ─── Tags ───

export const listAllTags = (workspaceId?: string) =>
  invoke<string[]>("list_all_tags", { workspaceId });

// ─── Trash ───

export const listTrashItems = (workspaceId?: string) =>
  invoke<TrashItem[]>("list_trash_items", { workspaceId });

export const restoreFromTrash = (trashItemId: string, workspaceId?: string) =>
  invoke<void>("restore_from_trash", { trashItemId, workspaceId });

export const permanentlyDelete = (trashItemId: string, workspaceId?: string) =>
  invoke<void>("permanently_delete", { trashItemId, workspaceId });

export const emptyTrash = (workspaceId?: string) =>
  invoke<void>("empty_trash", { workspaceId });

// ─── Search ───

export const searchPages = (
  query: import("@/types/search").SearchQuery,
  workspaceId?: string,
) =>
  invoke<import("@/types/search").SearchResults>("search_pages", {
    query,
    workspaceId,
  });

export const quickOpen = (
  query: string,
  limit?: number,
  workspaceId?: string,
) =>
  invoke<import("@/types/search").SearchResultItem[]>("quick_open", {
    query,
    limit,
    workspaceId,
  });

export const reindexPage = (pageId: PageId, workspaceId?: string) =>
  invoke<void>("reindex_page", { pageId, workspaceId });

export const rebuildIndex = (workspaceId?: string) =>
  invoke<number>("rebuild_index", { workspaceId });

export const getIndexStatus = (workspaceId?: string) =>
  invoke<import("@/types/search").IndexStatus>("get_index_status", {
    workspaceId,
  });

export const searchAllWorkspaces = (
  query: import("@/types/search").SearchQuery,
) =>
  invoke<import("@/types/search").CrossWorkspaceResult[]>(
    "search_all_workspaces",
    { query },
  );

// ─── Sync ───

export interface ProviderConnectionStatus {
  name: string;
  displayName: string;
  connected: boolean;
  email: string | null;
  errorMsg: string | null;
}

export const connectProvider = (providerName: string) =>
  invoke<string>("connect_provider", { providerName });

export const disconnectProvider = (providerName: string) =>
  invoke<void>("disconnect_provider", { providerName });

export const disconnectProviderByName = (providerName: string) =>
  invoke<void>("disconnect_provider_by_name", { providerName });

export const getProviderStatus = () =>
  invoke<ProviderConnectionStatus[]>("get_provider_status");

export const syncInitialUpload = (providerName: string) =>
  invoke<number>("sync_initial_upload", { providerName });

export const getSyncProviders = () =>
  invoke<import("@/types/sync").ProviderInfo[]>("get_sync_providers");

export const getSyncStatus = () =>
  invoke<import("@/types/sync").SyncStatus>("get_sync_status");

export const getSyncConfig = () =>
  invoke<import("@/types/sync").SyncPreferences>("get_sync_config");

export const setSyncConfig = (config: import("@/types/sync").SyncPreferences) =>
  invoke<void>("set_sync_config", { config });

export const getSyncConflicts = () =>
  invoke<import("@/types/sync").SyncConflict[]>("get_sync_conflicts");

export const resolveSyncConflict = (
  conflictId: string,
  resolution: import("@/types/sync").ConflictResolution,
) => invoke<void>("resolve_sync_conflict", { conflictId, resolution });

export const syncBidirectional = (providerName: string) =>
  invoke<import("@/types/sync").SyncBidirectionalResult>("sync_bidirectional", {
    providerName,
  });

export const listRemoteWorkspaces = (providerName: string) =>
  invoke<import("@/types/sync").RemoteWorkspaceInfo[]>(
    "list_remote_workspaces",
    { providerName },
  );

export interface DownloadResult {
  count: number;
  localPath: string;
}

export const downloadWorkspace = (
  providerName: string,
  workspaceName: string,
) =>
  invoke<DownloadResult>("download_workspace", {
    providerName,
    workspaceName,
  });

export const getOpennoteDir = () => invoke<string>("get_opennote_dir");

export interface DownloadedWorkspace {
  name: string;
  localPath: string;
}

export const listDownloadedWorkspaces = () =>
  invoke<DownloadedWorkspace[]>("list_downloaded_workspaces");

// ─── Quick Notes ───

/** Garante que o notebook e a section "Quick Notes" existem. Cria se necessário.
 *  Retorna o SectionId como string. */
export const ensureQuickNotes = (workspaceId?: string) =>
  invoke<string>("ensure_quick_notes", { workspaceId });

// ─── Discovery ───

/** Retorna até `count` páginas aleatórias excluindo os IDs em `excludeIds` e protegidas. */
export const getRandomPages = (
  count: number,
  excludeIds: string[],
  workspaceId?: string,
) =>
  invoke<PageSummary[]>("get_random_pages", {
    count,
    excludeIds,
    workspaceId,
  });

// ─── Spell Check ───

export const checkSpelling = (
  request: import("@/types/spellcheck").SpellCheckRequest,
) =>
  invoke<import("@/types/spellcheck").SpellCheckResponse>("check_spelling", {
    request,
  });
