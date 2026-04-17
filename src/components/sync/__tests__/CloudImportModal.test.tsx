import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudImportModal } from "../CloudImportModal";
import type { RemoteWorkspaceInfo } from "@/types/sync";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockIpc = vi.hoisted(() => ({
  downloadWorkspace: vi.fn(),
  openWorkspace: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ipc", () => mockIpc);

const mockOpenWorkspace = vi.fn().mockResolvedValue(undefined);
vi.mock("@/stores/useWorkspaceStore", () => ({
  useWorkspaceStore: (selector: (s: { n: typeof mockOpenWorkspace }) => unknown) =>
    selector({ n: mockOpenWorkspace }),
}));

const workspaces: RemoteWorkspaceInfo[] = [
  { name: "Trabalho", provider: "google_drive", file_count: null },
  { name: "Pessoal", provider: "google_drive", file_count: null },
];

describe("CloudImportModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIpc.downloadWorkspace.mockResolvedValue({
      count: 5,
      local_path: "/Users/user/Documents/OpenNote/Trabalho",
    });
    mockOpenWorkspace.mockResolvedValue(undefined);
  });

  it("renders modal title and workspace list", () => {
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={workspaces}
        defaultDestDir="/Users/user/Documents/OpenNote"
        onClose={onClose}
      />,
    );
    expect(screen.getByText(/dados encontrados na nuvem/i)).toBeInTheDocument();
    expect(screen.getByText("Trabalho")).toBeInTheDocument();
    expect(screen.getByText("Pessoal")).toBeInTheDocument();
  });

  it("shows Baixar button for each workspace", () => {
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={workspaces}
        defaultDestDir="/Users/user/Documents/OpenNote"
        onClose={onClose}
      />,
    );
    const downloadBtns = screen.getAllByText(/^Baixar$/);
    expect(downloadBtns).toHaveLength(2);
  });

  it("downloads a single workspace when Baixar is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={workspaces}
        defaultDestDir="/Users/user/Documents/OpenNote"
        onClose={onClose}
      />,
    );
    const firstBtn = screen.getAllByText(/^Baixar$/)[0]!;
    await user.click(firstBtn);
    await waitFor(() =>
      expect(mockIpc.downloadWorkspace).toHaveBeenCalledWith(
        "google_drive",
        "Trabalho",
        "/Users/user/Documents/OpenNote/Trabalho",
      ),
    );
  });

  it("shows done state and Open button after download completes", async () => {
    const user = userEvent.setup();
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={workspaces}
        defaultDestDir="/Users/user/Documents/OpenNote"
        onClose={onClose}
      />,
    );
    const firstBtn = screen.getAllByText(/^Baixar$/)[0]!;
    await user.click(firstBtn);
    await waitFor(() =>
      expect(screen.getByText(/5 arquivo/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/abrir/i)).toBeInTheDocument();
  });

  it("does NOT auto-open workspace after download", async () => {
    const user = userEvent.setup();
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={[
          { name: "Trabalho", provider: "google_drive", file_count: null },
        ]}
        defaultDestDir="/Users/user/Documents/OpenNote"
        onClose={onClose}
      />,
    );
    await user.click(screen.getByText(/^Baixar$/));
    await waitFor(() =>
      expect(screen.getByText(/5 arquivo/i)).toBeInTheDocument(),
    );
    expect(mockOpenWorkspace).not.toHaveBeenCalled();
  });

  it("opens workspace and closes modal when Open button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={[
          { name: "Trabalho", provider: "google_drive", file_count: null },
        ]}
        defaultDestDir="/Users/user/Documents/OpenNote"
        onClose={onClose}
      />,
    );
    await user.click(screen.getByText(/^Baixar$/));
    await waitFor(() => expect(screen.getByText(/abrir/i)).toBeInTheDocument());
    await user.click(screen.getByText(/abrir/i));
    await waitFor(() =>
      expect(mockOpenWorkspace).toHaveBeenCalledWith(
        "/Users/user/Documents/OpenNote/Trabalho",
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("shows open error when openWorkspace fails", async () => {
    mockOpenWorkspace.mockRejectedValue(
      new Error("permission denied (os error 13)"),
    );
    const user = userEvent.setup();
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={[
          { name: "Trabalho", provider: "google_drive", file_count: null },
        ]}
        defaultDestDir="/Users/user/Documents/OpenNote"
        onClose={onClose}
      />,
    );
    await user.click(screen.getByText(/^Baixar$/));
    await waitFor(() => expect(screen.getByText(/abrir/i)).toBeInTheDocument());
    await user.click(screen.getByText(/abrir/i));
    await waitFor(() =>
      expect(screen.getByText(/erro ao abrir/i)).toBeInTheDocument(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows error state when download fails", async () => {
    mockIpc.downloadWorkspace.mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={[
          { name: "Trabalho", provider: "google_drive", file_count: null },
        ]}
        defaultDestDir="/Users/user/Documents/OpenNote"
        onClose={onClose}
      />,
    );
    await user.click(screen.getByText(/^Baixar$/));
    await waitFor(() =>
      expect(screen.getByText(/erro ao baixar/i)).toBeInTheDocument(),
    );
  });

  it("downloads all workspaces when Baixar tudo is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={workspaces}
        defaultDestDir="/Users/user/Documents/OpenNote"
        onClose={onClose}
      />,
    );
    await user.click(screen.getByText(/baixar tudo/i));
    await waitFor(() =>
      expect(mockIpc.downloadWorkspace).toHaveBeenCalledTimes(2),
    );
  });

  it("calls onClose when Pular is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={workspaces}
        defaultDestDir="/Users/user/Documents/OpenNote"
        onClose={onClose}
      />,
    );
    await user.click(screen.getByText(/pular/i));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows Fechar instead of Pular after all done", async () => {
    mockIpc.downloadWorkspace.mockResolvedValue({
      count: 3,
      local_path: "/Users/user/Documents/OpenNote/Trabalho",
    });
    const user = userEvent.setup();
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={[
          { name: "Trabalho", provider: "google_drive", file_count: null },
        ]}
        defaultDestDir="/Users/user/Documents/OpenNote"
        onClose={onClose}
      />,
    );
    await user.click(screen.getByText(/^Baixar$/));
    await waitFor(() =>
      expect(screen.getByText(/fechar/i)).toBeInTheDocument(),
    );
  });
});
