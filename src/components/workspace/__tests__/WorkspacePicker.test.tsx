import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkspacePicker } from "../WorkspacePicker";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));

const mockIpc = vi.hoisted(() => ({
  getAppState: vi.fn(),
  removeRecentWorkspace: vi.fn(),
}));

vi.mock("@/lib/ipc", () => mockIpc);
vi.mock("@/stores/useWorkspaceStore", () => ({
  useWorkspaceStore: () => ({
    openWorkspace: vi.fn(),
    createWorkspace: vi.fn(),
  }),
}));

describe("WorkspacePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ showWorkspacePicker: true });
    mockIpc.getAppState.mockResolvedValue({
      recent_workspaces: [],
      last_opened_workspace: null,
      global_settings: {
        theme: {
          base_theme: "system",
          accent_color: "Blue",
          chrome_tint: "neutral",
        },
        language: "en",
        window_bounds: null,
      },
    });
  });

  it("renders workspace picker", async () => {
    render(<WorkspacePicker />);
    expect(screen.getByTestId("workspace-picker")).toBeInTheDocument();
  });

  it("shows title", async () => {
    render(<WorkspacePicker />);
    expect(
      await screen.findByTestId("workspace-picker-title"),
    ).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(<WorkspacePicker />);
    expect(screen.getByText(/loading|carregando/i)).toBeInTheDocument();
  });

  it("shows create and open buttons after loading", async () => {
    render(<WorkspacePicker />);
    expect(
      await screen.findByTestId("workspace-create-btn"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("workspace-open-btn")).toBeInTheDocument();
  });

  it("shows cloud button (enabled)", async () => {
    render(<WorkspacePicker />);
    expect(await screen.findByTestId("workspace-cloud-btn")).not.toBeDisabled();
  });

  it("shows recent workspaces when available", async () => {
    mockIpc.getAppState.mockResolvedValue({
      recent_workspaces: [
        { name: "Project A", path: "/tmp/project-a" },
        { name: "Project B", path: "/tmp/project-b" },
      ],
      last_opened_workspace: null,
      global_settings: {
        theme: {
          base_theme: "system",
          accent_color: "Blue",
          chrome_tint: "neutral",
        },
        language: "en",
        window_bounds: null,
      },
    });
    render(<WorkspacePicker />);
    expect(await screen.findByText("Project A")).toBeInTheDocument();
    expect(screen.getByText("Project B")).toBeInTheDocument();
  });

  it("shows create form when create button clicked", async () => {
    const user = userEvent.setup();
    render(<WorkspacePicker />);
    await screen.findByTestId("workspace-create-btn");
    await user.click(screen.getByTestId("workspace-create-btn"));
    expect(screen.getByTestId("workspace-create-form")).toBeInTheDocument();
  });

  it("shows name input in create form", async () => {
    const user = userEvent.setup();
    render(<WorkspacePicker />);
    await screen.findByTestId("workspace-create-btn");
    await user.click(screen.getByTestId("workspace-create-btn"));
    expect(screen.getByTestId("workspace-name-input")).toBeInTheDocument();
  });

  it("shows error state when getAppState fails", async () => {
    mockIpc.getAppState.mockRejectedValue(new Error("Network error"));
    render(<WorkspacePicker />);
    expect(await screen.findByTestId("workspace-error")).toBeInTheDocument();
  });

  it("modal_mode_has_backdrop", () => {
    render(<WorkspacePicker mode="modal" onClose={vi.fn()} />);
    const backdrop = screen.getByTestId("workspace-picker");
    expect(backdrop.classList.contains("fixed")).toBe(true);
  });

  it("modal_mode_has_close_button", async () => {
    render(<WorkspacePicker mode="modal" onClose={vi.fn()} />);
    expect(
      await screen.findByTestId("workspace-picker-close"),
    ).toBeInTheDocument();
  });

  it("modal_mode_close_button_calls_onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WorkspacePicker mode="modal" onClose={onClose} />);
    const closeBtn = await screen.findByTestId("workspace-picker-close");
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("fullscreen_mode_unchanged", () => {
    render(<WorkspacePicker mode="fullscreen" />);
    const picker = screen.getByTestId("workspace-picker");
    expect(picker).not.toHaveStyle({ backdropFilter: "blur(4px)" });
  });
});
