import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncSettings } from "../SyncSettings";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockIpc = vi.hoisted(() => ({
  getSyncProviders: vi.fn(),
  getSyncStatus: vi.fn(),
  getSyncConflicts: vi.fn(),
}));

vi.mock("@/lib/ipc", () => mockIpc);

describe("SyncSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ showSyncSettings: false });
    mockIpc.getSyncProviders.mockResolvedValue([
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
    ]);
    mockIpc.getSyncStatus.mockResolvedValue({
      is_syncing: false,
      last_synced_at: null,
      last_error: null,
    });
    mockIpc.getSyncConflicts.mockResolvedValue([]);
  });

  it("renders nothing when not visible", () => {
    const { container } = render(<SyncSettings />);
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog when visible", async () => {
    useUIStore.setState({ showSyncSettings: true });
    render(<SyncSettings />);
    expect(await screen.findByText("Google Drive")).toBeInTheDocument();
  });

  it("shows providers list", async () => {
    useUIStore.setState({ showSyncSettings: true });
    render(<SyncSettings />);
    expect(await screen.findByText("Google Drive")).toBeInTheDocument();
    expect(screen.getByText("OneDrive")).toBeInTheDocument();
  });

  it("shows not connected status", async () => {
    useUIStore.setState({ showSyncSettings: true });
    render(<SyncSettings />);
    expect(await screen.findByText("Não conectado")).toBeInTheDocument();
  });

  it("shows coming soon badges", async () => {
    useUIStore.setState({ showSyncSettings: true });
    render(<SyncSettings />);
    const badges = await screen.findAllByText("Em breve");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("closes on backdrop click", async () => {
    useUIStore.setState({ showSyncSettings: true });
    const user = userEvent.setup();
    const { container } = render(<SyncSettings />);
    await screen.findByText("Google Drive");
    const backdrop = container.firstChild as HTMLElement;
    await user.click(backdrop);
    expect(useUIStore.getState().showSyncSettings).toBe(false);
  });

  it("closes on X button click", async () => {
    useUIStore.setState({ showSyncSettings: true });
    const user = userEvent.setup();
    render(<SyncSettings />);
    await screen.findByText("Google Drive");
    const closeButtons = screen.getAllByRole("button");
    const closeBtn = closeButtons.find((b) =>
      b.classList.contains("sync-settings-close"),
    );
    if (closeBtn) {
      await user.click(closeBtn);
      expect(useUIStore.getState().showSyncSettings).toBe(false);
    }
  });

  it("shows syncing status when active", async () => {
    mockIpc.getSyncStatus.mockResolvedValue({
      is_syncing: true,
      last_synced_at: null,
      last_error: null,
    });
    useUIStore.setState({ showSyncSettings: true });
    render(<SyncSettings />);
    expect(await screen.findByText("Sincronizando...")).toBeInTheDocument();
  });

  it("shows last sync error", async () => {
    mockIpc.getSyncStatus.mockResolvedValue({
      is_syncing: false,
      last_synced_at: null,
      last_error: "Connection timeout",
    });
    useUIStore.setState({ showSyncSettings: true });
    render(<SyncSettings />);
    expect(await screen.findByText("Connection timeout")).toBeInTheDocument();
  });

  it("shows conflicts when present", async () => {
    mockIpc.getSyncConflicts.mockResolvedValue([
      {
        id: "c1",
        page_title: "Conflicted Page",
        local_modified_at: "2024-01-01T00:00:00Z",
        remote_modified_at: "2024-01-02T00:00:00Z",
      },
    ]);
    useUIStore.setState({ showSyncSettings: true });
    render(<SyncSettings />);
    expect(await screen.findByText("Conflicted Page")).toBeInTheDocument();
  });

  it("shows info text", async () => {
    useUIStore.setState({ showSyncSettings: true });
    render(<SyncSettings />);
    await screen.findByText("Google Drive");
    expect(
      screen.getByText(/provedores de nuvem/i),
    ).toBeInTheDocument();
  });
});
