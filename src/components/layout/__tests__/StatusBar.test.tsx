import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusBar } from "../StatusBar";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("StatusBar", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ workspace: null });
    usePageStore.setState({
      currentPage: null,
      saveStatus: "idle",
      lastSavedAt: null,
    });
  });

  it("renders workspace path when workspace is open", () => {
    useWorkspaceStore.setState({
      workspace: { root_path: "/tmp/my-ws" } as never,
    });
    render(<StatusBar />);
    expect(screen.getByTestId("status-workspace-path")).toHaveTextContent(
      "/tmp/my-ws",
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
