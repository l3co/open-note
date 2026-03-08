/**
 * Centralized selectors for E2E tests.
 * Uses data-testid attributes added to React components.
 * Fallbacks to aria-labels and CSS classes where testid is not feasible.
 */

// ─── App Shell ───
export const APP = {
  loading: '[data-testid="app-loading"]',
  main: '[data-testid="app-main"]',
} as const;

// ─── Workspace Picker ───
export const WORKSPACE_PICKER = {
  root: '[data-testid="workspace-picker"]',
  title: '[data-testid="workspace-picker-title"]',
  recentList: '[data-testid="workspace-recent-list"]',
  recentItem: '[data-testid="workspace-recent-item"]',
  removeRecent: '[aria-label]', // uses dynamic aria-label
  createButton: '[data-testid="workspace-create-btn"]',
  openButton: '[data-testid="workspace-open-btn"]',
  cloudButton: '[data-testid="workspace-cloud-btn"]',
  createForm: '[data-testid="workspace-create-form"]',
  nameInput: '[data-testid="workspace-name-input"]',
  pathInput: '[data-testid="workspace-path-input"]',
  confirmCreate: '[data-testid="workspace-confirm-create"]',
  cancelCreate: '[data-testid="workspace-cancel-create"]',
  error: '[data-testid="workspace-error"]',
} as const;

// ─── Sidebar ───
export const SIDEBAR = {
  root: '[data-testid="sidebar"]',
  nav: '[data-testid="sidebar-nav"]',
  resizeHandle: '[data-testid="sidebar-resize-handle"]',
  footer: '[data-testid="sidebar-footer"]',
  newNotebookBtn: '[aria-label="Novo Notebook"]',
  trashBtn: '[aria-label="Lixeira"]',
  settingsBtn: '[aria-label="Configurações"]',
  workspaceBtn: '[aria-label="Abrir workspace existente"]',
} as const;

// ─── Notebook Tree ───
export const TREE = {
  root: '[role="tree"]',
  item: '[role="treeitem"]',
  notebookItem: '[data-testid="tree-notebook"]',
  sectionItem: '[data-testid="tree-section"]',
  pageItem: '[data-testid="tree-page"]',
} as const;

// ─── Toolbar ───
export const TOOLBAR = {
  root: '[data-testid="toolbar"]',
  toggleSidebar: '[aria-label="Alternar sidebar"]',
  backBtn: '[aria-label="Back"]',
  forwardBtn: '[aria-label="Forward"]',
  breadcrumb: '[data-testid="breadcrumb"]',
} as const;

// ─── Content Area ───
export const CONTENT = {
  root: '[data-testid="content-area"]',
  welcomePage: '[data-testid="welcome-page"]',
  pageView: '[data-testid="page-view"]',
  loading: '[data-testid="content-loading"]',
} as const;

// ─── Page Editor ───
export const EDITOR = {
  root: '[data-testid="page-editor"]',
  title: '[data-testid="title-editor"]',
  modeToggle: '[data-testid="editor-mode-toggle"]',
  richtextBtn: '[data-testid="mode-richtext"]',
  markdownBtn: '[data-testid="mode-markdown"]',
  blockEditor: '.tiptap',
  markdownEditor: '.cm-editor',
  floatingToolbar: '[data-testid="floating-toolbar"]',
  slashMenu: '[data-testid="slash-menu"]',
  slashMenuItem: '[data-testid="slash-menu-item"]',
} as const;

// ─── Status Bar ───
export const STATUS_BAR = {
  root: '[data-testid="status-bar"]',
  workspacePath: '[data-testid="status-workspace-path"]',
  blockCount: '[data-testid="status-block-count"]',
  saveStatus: '[data-testid="status-save"]',
  syncBtn: '[data-testid="status-sync-btn"]',
} as const;

// ─── Dialogs ───
export const CREATE_DIALOG = {
  root: '[role="dialog"]',
  input: '[data-testid="create-dialog-input"]',
  confirmBtn: '[data-testid="create-dialog-confirm"]',
  cancelBtn: '[data-testid="create-dialog-cancel"]',
  error: '[data-testid="create-dialog-error"]',
} as const;

export const DELETE_DIALOG = {
  root: '[role="alertdialog"]',
  confirmBtn: '[data-testid="delete-dialog-confirm"]',
  cancelBtn: '[data-testid="delete-dialog-cancel"]',
} as const;

// ─── Trash Panel ───
export const TRASH_PANEL = {
  root: '[data-testid="trash-panel"]',
  emptyBtn: '[data-testid="trash-empty-btn"]',
  closeBtn: '[aria-label="Fechar"]',
  item: '[data-testid="trash-item"]',
  restoreBtn: '[data-testid="trash-restore-btn"]',
  deleteBtn: '[data-testid="trash-delete-btn"]',
  emptyState: '[data-testid="trash-empty-state"]',
} as const;

// ─── Quick Open ───
export const QUICK_OPEN = {
  backdrop: '[data-testid="quick-open-backdrop"]',
  dialog: '[data-testid="quick-open-dialog"]',
  input: '[data-testid="quick-open-input"]',
  results: '[data-testid="quick-open-results"]',
  resultItem: '[data-testid="quick-open-result"]',
  empty: '[data-testid="quick-open-empty"]',
} as const;

// ─── Search Panel ───
export const SEARCH_PANEL = {
  root: '[data-testid="search-panel"]',
  input: '[data-testid="search-panel-input"]',
  closeBtn: '[data-testid="search-panel-close"]',
  results: '[data-testid="search-panel-results"]',
  resultItem: '[data-testid="search-panel-result"]',
  meta: '[data-testid="search-panel-meta"]',
  empty: '[data-testid="search-panel-empty"]',
} as const;

// ─── Sync Settings ───
export const SYNC_SETTINGS = {
  backdrop: '[data-testid="sync-settings-backdrop"]',
  panel: '[data-testid="sync-settings-panel"]',
  closeBtn: '[data-testid="sync-settings-close"]',
  providerCard: '[data-testid="sync-provider-card"]',
  conflictItem: '[data-testid="sync-conflict-item"]',
} as const;

// ─── Settings Dialog ───
export const SETTINGS = {
  root: '[data-testid="settings-dialog"]',
  closeBtn: '[aria-label="Fechar"]',
  tabGeneral: '[data-testid="settings-tab-general"]',
  tabAppearance: '[data-testid="settings-tab-appearance"]',
  tabEditor: '[data-testid="settings-tab-editor"]',
  tabSync: '[data-testid="settings-tab-sync"]',
  tabShortcuts: '[data-testid="settings-tab-shortcuts"]',
  tabAbout: '[data-testid="settings-tab-about"]',
  content: '[data-testid="settings-content"]',
} as const;

// ─── Onboarding ───
export const ONBOARDING = {
  root: '[data-testid="onboarding-dialog"]',
  welcomeStep: '[data-testid="onboarding-welcome"]',
  startBtn: '[data-testid="onboarding-start"]',
  skipBtn: '[data-testid="onboarding-skip"]',
  nextBtn: '[data-testid="onboarding-next"]',
  backBtn: '[data-testid="onboarding-back"]',
  progressDots: '[data-testid="onboarding-progress"]',
  tourStep: '[data-testid="onboarding-tour-step"]',
} as const;

// ─── Context Menu ───
export const CONTEXT_MENU = {
  root: '[data-testid="context-menu"]',
  renameItem: '[data-testid="context-rename"]',
  deleteItem: '[data-testid="context-delete"]',
  newSectionItem: '[data-testid="context-new-section"]',
  newPageItem: '[data-testid="context-new-page"]',
} as const;
