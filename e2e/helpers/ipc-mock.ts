import type { Page } from "@playwright/test";

/**
 * Default mock data used by the IPC mock layer.
 * Each IPC command maps to a function returning the mock response.
 */
export interface MockOverrides {
  [command: string]: (...args: unknown[]) => unknown;
}

const DEFAULT_APP_STATE = {
  recent_workspaces: [],
  last_opened_workspace: null,
  global_settings: {
    theme: {
      base_theme: "system",
      accent_color: "Blue",
      chrome_tint: "neutral",
    },
    language: "pt-BR",
    window_bounds: null,
  },
};

const DEFAULT_WORKSPACE = {
  id: "ws-001",
  name: "Test Workspace",
  root_path: "/tmp/test-workspace",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  settings: {
    default_notebook_id: null,
    auto_save_interval_ms: 2000,
    sidebar_width: 260,
    sidebar_open: true,
    last_opened_page_id: null,
    quick_notes_notebook_id: null,
    quick_notes_section_id: null,
  },
};

const DEFAULT_NOTEBOOK = {
  id: "nb-001",
  name: "Pessoal",
  sort_order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEFAULT_SECTION = {
  id: "sec-001",
  notebook_id: "nb-001",
  name: "Geral",
  sort_order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEFAULT_PAGE = {
  id: "page-001",
  section_id: "sec-001",
  title: "Notas do dia",
  blocks: [],
  tags: [],
  annotations: { strokes: [], highlights: [] },
  editor_preferences: { mode: "richtext" },
  schema_version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEFAULT_PAGE_SUMMARY = {
  id: "page-001",
  title: "Notas do dia",
  tags: [],
  mode: "richtext",
  block_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Default IPC handlers — covers all 46 commands.
 * Each handler receives the raw IPC args object as its single argument.
 * Override specific commands via `overrides` parameter.
 */
function buildDefaultHandlers(overrides: MockOverrides = {}): MockOverrides {
  const defaults: MockOverrides = {
    // App
    get_app_state: () => DEFAULT_APP_STATE,

    // Workspace
    create_workspace: () => DEFAULT_WORKSPACE,
    open_workspace: () => DEFAULT_WORKSPACE,
    close_workspace: () => null,
    focus_workspace: () => null,
    switch_workspace: () => null,
    list_open_workspaces: () => [
      {
        id: DEFAULT_WORKSPACE.id,
        name: DEFAULT_WORKSPACE.name,
        root_path: DEFAULT_WORKSPACE.root_path,
      },
    ],
    remove_recent_workspace: () => null,
    get_workspace_settings: () => ({}),
    update_workspace_settings: () => null,
    get_global_settings: () => DEFAULT_APP_STATE.global_settings,
    update_global_settings: () => null,

    // Notebook
    list_notebooks: () => [DEFAULT_NOTEBOOK],
    create_notebook: (args: unknown) => ({
      ...DEFAULT_NOTEBOOK,
      id: `nb-${Date.now()}`,
      name: (args as { name?: string }).name,
    }),
    rename_notebook: () => DEFAULT_NOTEBOOK,
    delete_notebook: () => null,
    reorder_notebooks: () => null,

    // Section
    list_sections: () => [DEFAULT_SECTION],
    create_section: (args: unknown) => ({
      ...DEFAULT_SECTION,
      id: `sec-${Date.now()}`,
      name: (args as { name?: string }).name,
    }),
    rename_section: () => DEFAULT_SECTION,
    delete_section: () => null,
    reorder_sections: () => null,
    move_section: () => DEFAULT_SECTION,

    // Page
    list_pages: () => [DEFAULT_PAGE_SUMMARY],
    load_page: () => DEFAULT_PAGE,
    create_page: (args: unknown) => ({
      ...DEFAULT_PAGE,
      id: `page-${Date.now()}`,
      title: (args as { title?: string }).title,
    }),
    create_canvas_page: (args: unknown) => ({
      ...DEFAULT_PAGE,
      id: `page-canvas-${Date.now()}`,
      title: (args as { title?: string }).title ?? "Untitled Canvas",
      canvas_state: null,
      pdf_asset: null,
      pdf_total_pages: null,
      editor_preferences: { mode: "canvas", split_view: false },
    }),
    update_page: () => null,
    update_page_blocks: () => DEFAULT_PAGE,
    update_page_canvas_state: () => null,
    delete_page: () => null,
    move_page: () => DEFAULT_PAGE,

    // File I/O
    read_file_content: () => "",
    save_file_content: () => null,

    // PDF
    import_pdf: () => ["asset-id", 5],

    // Tags
    list_all_tags: () => [],

    // Trash
    list_trash_items: () => [],
    restore_from_trash: () => null,
    permanently_delete: () => null,
    empty_trash: () => null,

    // Search
    search_pages: () => ({ items: [], total: 0, query_time_ms: 1 }),
    quick_open: () => [],
    reindex_page: () => null,
    rebuild_index: () => 0,
    get_index_status: () => ({ total_documents: 0, index_size_bytes: 0 }),
    search_all_workspaces: () => [],

    // Spell check
    check_spelling: () => ({ corrections: [] }),

    // Sync
    get_sync_providers: () => [
      {
        name: "google_drive",
        display_name: "Google Drive",
        connected: false,
        user_email: null,
        last_synced_at: null,
      },
      {
        name: "onedrive",
        display_name: "OneDrive",
        connected: false,
        user_email: null,
        last_synced_at: null,
      },
      {
        name: "dropbox",
        display_name: "Dropbox",
        connected: false,
        user_email: null,
        last_synced_at: null,
      },
    ],
    get_sync_status: () => ({
      is_syncing: false,
      last_synced_at: null,
      last_error: null,
    }),
    get_sync_config: () => ({ auto_sync: false, interval_minutes: 15 }),
    set_sync_config: () => null,
    get_sync_conflicts: () => [],
    resolve_sync_conflict: () => null,
  };

  return { ...defaults, ...overrides };
}

/**
 * Injects the Tauri IPC mock into the page.
 *
 * Must be called BEFORE navigating to the app URL (via `page.addInitScript`).
 *
 * @example
 * ```ts
 * await setupIpcMock(page, {
 *   get_app_state: () => ({ ...customState }),
 *   list_notebooks: () => [nb1, nb2],
 * });
 * await page.goto("http://localhost:1420");
 * ```
 */
export async function setupIpcMock(
  page: Page,
  overrides: MockOverrides = {},
): Promise<void> {
  const handlers = buildDefaultHandlers(overrides);

  // Expose Node.js handlers to the browser via exposeFunction.
  // Unlike addInitScript with pre-computed values, this allows handlers to
  // inspect the actual IPC args at call time (e.g. return different workspace
  // objects based on the requested path).
  await page.exposeFunction(
    "__opennote_ipc__",
    (cmd: string, args: unknown) => {
      const fn = handlers[cmd];
      if (!fn) {
        throw new Error(`[IPC Mock] Unknown command: ${cmd}`);
      }
      return fn(args);
    },
  );

  await page.addInitScript(() => {
    type IpcFn = (cmd: string, args: unknown) => Promise<unknown>;

    // Mock Tauri IPC internals — delegates to the Node.js handler
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      invoke: (cmd: string, args?: Record<string, unknown>) =>
        (window as unknown as { __opennote_ipc__: IpcFn }).__opennote_ipc__(
          cmd,
          args ?? {},
        ),
      convertFileSrc: (path: string) => path,
      transformCallback: () => 0,
    };

    // Mock @tauri-apps/plugin-dialog
    (window as unknown as Record<string, unknown>).__TAURI_PLUGIN_DIALOG__ = {
      open: () => Promise.resolve(null),
      save: () => Promise.resolve(null),
      message: () => Promise.resolve(null),
      ask: () => Promise.resolve(false),
      confirm: () => Promise.resolve(false),
    };
  });
}

// Re-export default data for use in fixtures
export {
  DEFAULT_APP_STATE,
  DEFAULT_WORKSPACE,
  DEFAULT_NOTEBOOK,
  DEFAULT_SECTION,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SUMMARY,
};
