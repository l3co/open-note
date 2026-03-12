import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudImportModal } from "../CloudImportModal";
import type { RemoteWorkspaceInfo } from "@/types/sync";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockIpc = vi.hoisted(() => ({
  downloadWorkspace: vi.fn(),
}));

vi.mock("@/lib/ipc", () => mockIpc);

const workspaces: RemoteWorkspaceInfo[] = [
  { name: "Trabalho", provider: "google_drive", file_count: null },
  { name: "Pessoal", provider: "google_drive", file_count: null },
];

describe("CloudImportModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIpc.downloadWorkspace.mockResolvedValue(5);
  });

  it("renders modal title and workspace list", () => {
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={workspaces}
        defaultDestDir="/tmp"
        onClose={onClose}
      />,
    );
    expect(
      screen.getByText(/dados encontrados na nuvem/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Trabalho")).toBeInTheDocument();
    expect(screen.getByText("Pessoal")).toBeInTheDocument();
  });

  it("shows Baixar button for each workspace", () => {
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={workspaces}
        defaultDestDir="/tmp"
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
        defaultDestDir="/tmp"
        onClose={onClose}
      />,
    );
    const [firstBtn] = screen.getAllByText(/^Baixar$/);
    await user.click(firstBtn);
    await waitFor(() =>
      expect(mockIpc.downloadWorkspace).toHaveBeenCalledWith(
        "google_drive",
        "Trabalho",
        "/tmp/Trabalho",
      ),
    );
  });

  it("shows done state after download completes", async () => {
    const user = userEvent.setup();
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={workspaces}
        defaultDestDir="/tmp"
        onClose={onClose}
      />,
    );
    const [firstBtn] = screen.getAllByText(/^Baixar$/);
    await user.click(firstBtn);
    await waitFor(() =>
      expect(screen.getByText(/5 arquivo/i)).toBeInTheDocument(),
    );
  });

  it("shows error state when download fails", async () => {
    mockIpc.downloadWorkspace.mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={[{ name: "Trabalho", provider: "google_drive", file_count: null }]}
        defaultDestDir="/tmp"
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
        defaultDestDir="/tmp"
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
        defaultDestDir="/tmp"
        onClose={onClose}
      />,
    );
    await user.click(screen.getByText(/pular/i));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows Fechar instead of Pular after all done", async () => {
    mockIpc.downloadWorkspace.mockResolvedValue(3);
    const user = userEvent.setup();
    render(
      <CloudImportModal
        providerName="google_drive"
        providerLabel="Google Drive"
        workspaces={[{ name: "Trabalho", provider: "google_drive", file_count: null }]}
        defaultDestDir="/tmp"
        onClose={onClose}
      />,
    );
    await user.click(screen.getByText(/^Baixar$/));
    await waitFor(() => expect(screen.getByText(/fechar/i)).toBeInTheDocument());
  });
});
