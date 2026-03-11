import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncSettings } from "../SyncSettings";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockIpc = vi.hoisted(() => ({
  getProviderStatus: vi.fn(),
  getSyncStatus: vi.fn(),
  disconnectProviderByName: vi.fn(),
  syncInitialUpload: vi.fn(),
}));

vi.mock("@/lib/ipc", () => mockIpc);

describe("SyncSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ showSyncSettings: false });
    mockIpc.getProviderStatus.mockResolvedValue([
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
    ]);
    mockIpc.getSyncStatus.mockResolvedValue({
      is_syncing: false,
      provider: null,
      progress: null,
      last_synced_at: null,
      last_error: null,
      pending_conflicts: 0,
    });
  });

  it("renders nothing when not visible", () => {
    const { container } = render(<SyncSettings />);
    expect(container.firstChild).toBeNull();
  });

  it("renders modal with title when visible", () => {
    useUIStore.setState({ showSyncSettings: true });
    const { container } = render(<SyncSettings />);
    expect(container.querySelector(".sync-settings-title")).toBeInTheDocument();
  });

  it("renders SyncSection content inside the modal", async () => {
    useUIStore.setState({ showSyncSettings: true });
    render(<SyncSettings />);
    expect(await screen.findByText("Google Drive")).toBeInTheDocument();
    expect(screen.getByText("Dropbox")).toBeInTheDocument();
  });

  it("closes on backdrop click", async () => {
    useUIStore.setState({ showSyncSettings: true });
    const user = userEvent.setup();
    const { container } = render(<SyncSettings />);
    await screen.findByText("Google Drive");
    await user.click(container.firstChild as HTMLElement);
    expect(useUIStore.getState().showSyncSettings).toBe(false);
  });

  it("closes on X button click", async () => {
    useUIStore.setState({ showSyncSettings: true });
    const user = userEvent.setup();
    render(<SyncSettings />);
    await screen.findByText("Google Drive");
    const closeBtn = screen.getByRole("button", { name: /fechar/i });
    await user.click(closeBtn);
    expect(useUIStore.getState().showSyncSettings).toBe(false);
  });
});
