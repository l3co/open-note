import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudConnectModal } from "../CloudConnectModal";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockIpc = vi.hoisted(() => ({
  getProviderStatus: vi.fn(),
  connectProvider: vi.fn(),
  listRemoteWorkspaces: vi.fn(),
  syncBidirectional: vi.fn(),
}));

vi.mock("@/lib/ipc", () => mockIpc);

describe("CloudConnectModal", () => {
  const onClose = vi.fn();
  const onConnected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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
    mockIpc.connectProvider.mockResolvedValue("user@gmail.com");
    mockIpc.listRemoteWorkspaces.mockResolvedValue([]);
    mockIpc.syncBidirectional.mockResolvedValue({
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      errors: [],
    });
  });

  it("renders provider list", async () => {
    render(
      <CloudConnectModal
        onClose={onClose}
        onConnected={onConnected}
      />,
    );
    expect(await screen.findByText("Google Drive")).toBeInTheDocument();
    expect(screen.getByText("Dropbox")).toBeInTheDocument();
  });

  it("selects a provider on click", async () => {
    const user = userEvent.setup();
    render(
      <CloudConnectModal
        onClose={onClose}
        onConnected={onConnected}
      />,
    );
    await screen.findByText("Google Drive");
    await user.click(screen.getByText("Google Drive"));
    expect(screen.getByRole("button", { name: /^conectar/i })).toBeEnabled();
  });

  it("pre-selects provider when initialProvider is set", async () => {
    render(
      <CloudConnectModal
        initialProvider="dropbox"
        onClose={onClose}
        onConnected={onConnected}
      />,
    );
    await screen.findByText("Dropbox");
    expect(screen.getByRole("button", { name: /conectar/i })).toBeEnabled();
  });

  it("calls connectProvider and onConnected on successful connect", async () => {
    const user = userEvent.setup();
    render(
      <CloudConnectModal
        initialProvider="google_drive"
        onClose={onClose}
        onConnected={onConnected}
      />,
    );
    await screen.findByText("Google Drive");
    await user.click(screen.getByRole("button", { name: /^conectar/i }));
    await waitFor(() =>
      expect(mockIpc.connectProvider).toHaveBeenCalledWith("google_drive"),
    );
    await waitFor(() =>
      expect(onConnected).toHaveBeenCalledWith("google_drive", "user@gmail.com"),
    );
  });

  it("shows error message when connectProvider fails", async () => {
    mockIpc.connectProvider.mockRejectedValue(new Error("auth failed"));
    const user = userEvent.setup();
    render(
      <CloudConnectModal
        initialProvider="google_drive"
        onClose={onClose}
        onConnected={onConnected}
      />,
    );
    await screen.findByText("Google Drive");
    await user.click(screen.getByRole("button", { name: /^conectar/i }));
    await waitFor(() =>
      expect(screen.getByText(/auth failed/i)).toBeInTheDocument(),
    );
  });

  it("shows CloudImportModal when remote workspaces exist after connect", async () => {
    mockIpc.listRemoteWorkspaces.mockResolvedValue([
      { name: "MeuWorkspace", provider: "google_drive", file_count: null },
    ]);
    const user = userEvent.setup();
    render(
      <CloudConnectModal
        initialProvider="google_drive"
        onClose={onClose}
        onConnected={onConnected}
      />,
    );
    await screen.findByText("Google Drive");
    await user.click(screen.getByRole("button", { name: /^conectar/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/dados encontrados na nuvem/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("MeuWorkspace")).toBeInTheDocument();
  });

  it("calls syncBidirectional when no remote workspaces found", async () => {
    mockIpc.listRemoteWorkspaces.mockResolvedValue([]);
    const user = userEvent.setup();
    render(
      <CloudConnectModal
        initialProvider="google_drive"
        onClose={onClose}
        onConnected={onConnected}
      />,
    );
    await screen.findByText("Google Drive");
    await user.click(screen.getByRole("button", { name: /^conectar/i }));
    await waitFor(() =>
      expect(mockIpc.syncBidirectional).toHaveBeenCalledWith("google_drive"),
    );
  });

  it("calls onClose when X button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CloudConnectModal
        onClose={onClose}
        onConnected={onConnected}
      />,
    );
    await screen.findByText("Google Drive");
    const closeBtn = screen.getByRole("button", { name: /fechar/i });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
