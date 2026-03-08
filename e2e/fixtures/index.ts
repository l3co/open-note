/**
 * Shared fixture data for E2E tests.
 * Provides realistic mock data for IPC responses.
 */

export const NOTEBOOKS = {
  pessoal: {
    id: "nb-pessoal",
    name: "Pessoal",
    sort_order: 0,
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-01-15T10:00:00Z",
  },
  trabalho: {
    id: "nb-trabalho",
    name: "Trabalho",
    sort_order: 1,
    created_at: "2025-01-16T10:00:00Z",
    updated_at: "2025-01-16T10:00:00Z",
  },
};

export const SECTIONS = {
  geral: {
    id: "sec-geral",
    notebook_id: "nb-pessoal",
    name: "Geral",
    sort_order: 0,
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-01-15T10:00:00Z",
  },
  projetos: {
    id: "sec-projetos",
    notebook_id: "nb-trabalho",
    name: "Projetos de Design",
    sort_order: 0,
    created_at: "2025-01-16T10:00:00Z",
    updated_at: "2025-01-16T10:00:00Z",
  },
};

export const PAGES = {
  notasDoDia: {
    id: "page-notas",
    section_id: "sec-geral",
    title: "Notas do dia",
    blocks: [
      {
        id: "block-1",
        block_type: "text",
        sort_order: 0,
        content: {
          tiptap_json: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Conteúdo de teste" }],
              },
            ],
          },
        },
        created_at: "2025-01-15T10:00:00Z",
        updated_at: "2025-01-15T10:00:00Z",
      },
    ],
    tags: ["pessoal", "diário"],
    annotations: { strokes: [], highlights: [] },
    editor_preferences: { mode: "richtext" },
    schema_version: 1,
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-01-15T10:00:00Z",
  },
  reuniaoVendas: {
    id: "page-reuniao",
    section_id: "sec-projetos",
    title: "Reunião de Vendas",
    blocks: [],
    tags: ["trabalho"],
    annotations: { strokes: [], highlights: [] },
    editor_preferences: { mode: "richtext" },
    schema_version: 1,
    created_at: "2025-01-16T11:00:00Z",
    updated_at: "2025-01-16T11:00:00Z",
  },
};

export const PAGE_SUMMARIES = {
  notasDoDia: {
    id: "page-notas",
    title: "Notas do dia",
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-01-15T10:00:00Z",
  },
  reuniaoVendas: {
    id: "page-reuniao",
    title: "Reunião de Vendas",
    created_at: "2025-01-16T11:00:00Z",
    updated_at: "2025-01-16T11:00:00Z",
  },
};

export const WORKSPACES = {
  casa: {
    id: "ws-casa",
    name: "Casa",
    root_path: "/tmp/workspace-casa",
    created_at: "2025-01-10T10:00:00Z",
    updated_at: "2025-01-10T10:00:00Z",
  },
  trabalho: {
    id: "ws-trabalho",
    name: "Trabalho",
    root_path: "/tmp/workspace-trabalho",
    created_at: "2025-01-12T10:00:00Z",
    updated_at: "2025-01-12T10:00:00Z",
  },
};

export const APP_STATE_WITH_RECENTS = {
  recent_workspaces: [
    { name: "Casa", path: "/tmp/workspace-casa" },
    { name: "Trabalho", path: "/tmp/workspace-trabalho" },
  ],
  last_opened_workspace: null,
  global_settings: {
    theme: {
      base_theme: "system" as const,
      accent_color: "Blue",
      chrome_tint: "neutral" as const,
    },
    language: "pt-BR",
    window_bounds: null,
  },
};

export const TRASH_ITEMS = {
  deletedPage: {
    id: "trash-001",
    item_type: "page",
    original_title: "Reunião de Vendas",
    original_path: "Trabalho/Projetos de Design/Reunião de Vendas",
    deleted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
  },
};

export const SEARCH_RESULTS = {
  faturamento: {
    items: [
      {
        page_id: "page-notas",
        title: "Notas do dia",
        snippet: "...conteúdo sobre faturamento 2026...",
        notebook_name: "Pessoal",
        section_name: "Geral",
        updated_at: "2025-01-15T10:00:00Z",
        score: 1.5,
      },
    ],
    total: 1,
    query_time_ms: 3,
  },
};

export const SYNC_PROVIDERS = [
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
];
