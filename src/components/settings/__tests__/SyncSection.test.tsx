import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncSection } from "../SyncSection";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockIpc = vi.hoisted(() => ({
  getProviderStatus: vi.fn(),
  getSyncStatus: vi.fn(),
  disconnectProviderByName: vi.fn(),
  syncInitialUpload: vi.fn(),
}));

vi.mock("@/lib/ipc", () => mockIpc);

const disconnectedProviders = [
  {
    name: "google_drive",
    displayName: "Google Drive",
    connected: false,
    email: null,
    errorMsg: null,
  },
  {
    name: "dropbox",
    displayName: "Dropbox",
    connected: false,
    email: null,
    errorMsg: null,
  },
];

const connectedProviders = [
  {
    name: "google_drive",
    displayName: "Google Drive",
    connected: true,
    email: "user@gmail.com",
    errorMsg: null,
  },
  {
    name: "dropbox",
    displayName: "Dropbox",
    connected: false,
    email: null,
    errorMsg: null,
  },
];

const defaultSyncStatus = {
  is_syncing: false,
  provider: null,
  progress: null,
  last_synced_at: null,
  last_error: null,
  pending_conflicts: 0,
};

describe("SyncSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpc.getProviderStatus.mockResolvedValue(disconnectedProviders);
    mockIpc.getSyncStatus.mockResolvedValue(defaultSyncStatus);
    mockIpc.syncInitialUpload.mockResolvedValue(5);
  });

  it("renders sync section title", () => {
    render(<SyncSection />);
    expect(screen.getByText(/sincroniza/i)).toBeInTheDocument();
  });

  it("shows provider list after loading", async () => {
    render(<SyncSection />);
    expect(await screen.findByText("Google Drive")).toBeInTheDocument();
    expect(screen.getByText("Dropbox")).toBeInTheDocument();
  });

  it("shows 'not connected' status when no provider connected", async () => {
    render(<SyncSection />);
    expect(await screen.findByText("Não conectado")).toBeInTheDocument();
  });

  it("shows 'Sincronizar agora' button when a provider is connected", async () => {
    mockIpc.getProviderStatus.mockResolvedValue(connectedProviders);
    mockIpc.getSyncStatus.mockResolvedValue({
      ...defaultSyncStatus,
      last_synced_at: null,
    });
    render(<SyncSection />);
    expect(await screen.findByTestId("sync-now-btn")).toBeInTheDocument();
  });

  it("does NOT show 'Sincronizar agora' when no provider connected", async () => {
    render(<SyncSection />);
    await screen.findByText("Google Drive");
    expect(screen.queryByTestId("sync-now-btn")).toBeNull();
  });

  it("calls syncInitialUpload when 'Sincronizar agora' is clicked", async () => {
    mockIpc.getProviderStatus.mockResolvedValue(connectedProviders);
    render(<SyncSection />);
    const btn = await screen.findByTestId("sync-now-btn");
    await userEvent.click(btn);
    await waitFor(() =>
      expect(mockIpc.syncInitialUpload).toHaveBeenCalledWith("google_drive"),
    );
  });

  it("shows last sync time when syncStatus has last_synced_at", async () => {
    mockIpc.getProviderStatus.mockResolvedValue(connectedProviders);
    mockIpc.getSyncStatus.mockResolvedValue({
      ...defaultSyncStatus,
      last_synced_at: new Date(Date.now() - 5 * 60000).toISOString(),
    });
    render(<SyncSection />);
    expect(await screen.findByText(/Último sync/i)).toBeInTheDocument();
  });

  it("shows 'Sincronizando...' when sync is in progress", async () => {
    mockIpc.getProviderStatus.mockResolvedValue(connectedProviders);
    mockIpc.getSyncStatus.mockResolvedValue({
      ...defaultSyncStatus,
      is_syncing: true,
    });
    render(<SyncSection />);
    expect(await screen.findByText("Sincronizando...")).toBeInTheDocument();
  });

  it("shows connect button for disconnected providers", async () => {
    render(<SyncSection />);
    await screen.findByText("Google Drive");
    const connectBtns = screen.getAllByRole("button", { name: /conectar/i });
    expect(connectBtns.length).toBeGreaterThan(0);
  });
});
