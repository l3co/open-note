import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusBar } from "../StatusBar";
import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/ipc", () => ({ focusWorkspace: vi.fn() }));

const defaultNav = () => ({
  activeView: "home" as const,
  selectedNotebookId: null,
  selectedSectionId: null,
  selectedPageId: null,
  expandedNotebooks: new Set<string>(),
  expandedSections: new Set<string>(),
  history: [] as string[],
  historyIndex: -1,
});

describe("StatusBar", () => {
  beforeEach(() => {
    useMultiWorkspaceStore.setState({
      workspaces: new Map(),
      focusedWorkspaceId: null,
    });
    usePageStore.setState({
      currentPage: null,
      saveStatus: "idle",
      lastSavedAt: null,
    });
  });

  it("renders workspace name when workspace is open", () => {
    useMultiWorkspaceStore.setState({
      workspaces: new Map([
        [
          "ws-1",
          {
            workspace: {
              id: "ws-1",
              name: "My Workspace",
              root_path: "/tmp/my-ws",
            } as never,
            notebooks: [],
            sections: new Map(),
            navigation: defaultNav(),
          },
        ],
      ]),
      focusedWorkspaceId: "ws-1",
    });
    render(<StatusBar />);
    expect(screen.getByTestId("status-workspace-path")).toHaveTextContent(
      "My Workspace",
    );
  });

  it("shows fallback when no workspace is open", () => {
    render(<StatusBar />);
    expect(screen.getByTestId("status-workspace-path")).toBeInTheDocument();
  });

  it("shows block count when page is loaded", () => {
    usePageStore.setState({
      currentPage: { blocks: [{}, {}, {}] } as never,
    });
    render(<StatusBar />);
    expect(screen.getByTestId("status-block-count")).toBeInTheDocument();
  });

  it("does not show block count when no page", () => {
    render(<StatusBar />);
    expect(screen.queryByTestId("status-block-count")).not.toBeInTheDocument();
  });

  it("shows save status when saving", () => {
    usePageStore.setState({
      currentPage: { blocks: [] } as never,
      saveStatus: "saving",
    });
    render(<StatusBar />);
    expect(screen.getByTestId("status-save")).toBeInTheDocument();
  });

  it("shows save error status", () => {
    usePageStore.setState({
      currentPage: { blocks: [] } as never,
      saveStatus: "error",
    });
    render(<StatusBar />);
    expect(screen.getByTestId("status-save")).toBeInTheDocument();
  });

  it("shows saved status with time", () => {
    usePageStore.setState({
      currentPage: { blocks: [] } as never,
      saveStatus: "saved",
      lastSavedAt: new Date(),
    });
    render(<StatusBar />);
    expect(screen.getByTestId("status-save")).toBeInTheDocument();
  });

  it("renders sync button", () => {
    render(<StatusBar />);
    expect(screen.getByTestId("status-sync-btn")).toBeInTheDocument();
  });

  it("sync button opens sync settings", async () => {
    const user = userEvent.setup();
    render(<StatusBar />);
    await user.click(screen.getByTestId("status-sync-btn"));
    expect(useUIStore.getState().showSyncSettings).toBe(true);
  });
});
