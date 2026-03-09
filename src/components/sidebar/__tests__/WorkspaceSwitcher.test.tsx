import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkspaceSwitcher } from "../WorkspaceSwitcher";
import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));

const mockIpc = vi.hoisted(() => ({
  focusWorkspace: vi.fn().mockResolvedValue(undefined),
  closeWorkspace: vi.fn().mockResolvedValue(undefined),
  openWorkspace: vi.fn(),
  rebuildIndex: vi.fn().mockResolvedValue(0),
  listNotebooks: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/ipc", () => mockIpc);

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

function makeSlice(id: string, name: string) {
  return {
    workspace: { id, name, root_path: `/tmp/${id}` } as never,
    notebooks: [],
    sections: new Map(),
    navigation: defaultNav(),
  };
}

function seedWorkspaces(focused = "ws-1") {
  useMultiWorkspaceStore.setState({
    workspaces: new Map([
      ["ws-1", makeSlice("ws-1", "My Studies")],
      ["ws-2", makeSlice("ws-2", "Work")],
    ]),
    focusedWorkspaceId: focused,
  });
}

describe("WorkspaceSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMultiWorkspaceStore.setState({
      workspaces: new Map(),
      focusedWorkspaceId: null,
    });
  });

  it("renders_focused_workspace_name", () => {
    seedWorkspaces();
    render(<WorkspaceSwitcher />);
    expect(screen.getByTestId("workspace-switcher-name")).toHaveTextContent(
      "My Studies",
    );
  });

  it("shows_none_open_when_no_workspace", () => {
    render(<WorkspaceSwitcher />);
    expect(screen.getByTestId("workspace-switcher-name")).not.toHaveTextContent(
      "My Studies",
    );
  });

  it("popover_lists_all_workspaces", async () => {
    seedWorkspaces();
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);

    await user.click(screen.getByTestId("workspace-switcher-trigger"));

    expect(
      screen.getByTestId("workspace-switcher-popover"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("workspace-item-ws-1")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-item-ws-2")).toBeInTheDocument();
  });

  it("focused_workspace_has_check_mark", async () => {
    seedWorkspaces("ws-1");
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);

    await user.click(screen.getByTestId("workspace-switcher-trigger"));

    const ws1Item = screen.getByTestId("workspace-item-ws-1");
    expect(ws1Item.getAttribute("aria-selected")).toBe("true");

    const ws2Item = screen.getByTestId("workspace-item-ws-2");
    expect(ws2Item.getAttribute("aria-selected")).toBe("false");
  });

  it("click_workspace_focuses_it", async () => {
    seedWorkspaces("ws-1");
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);

    await user.click(screen.getByTestId("workspace-switcher-trigger"));
    await user.click(screen.getByTestId("workspace-item-ws-2"));

    expect(mockIpc.focusWorkspace).toHaveBeenCalledWith("ws-2");
  });

  it("click_same_workspace_closes_popover", async () => {
    seedWorkspaces("ws-1");
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);

    await user.click(screen.getByTestId("workspace-switcher-trigger"));
    await user.click(screen.getByTestId("workspace-item-ws-1"));

    expect(
      screen.queryByTestId("workspace-switcher-popover"),
    ).not.toBeInTheDocument();
  });

  it("close_button_shows_confirmation", async () => {
    seedWorkspaces();
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);

    await user.click(screen.getByTestId("workspace-switcher-trigger"));

    const closeBtn = screen.getByTestId("workspace-close-ws-2");
    await user.click(closeBtn);

    expect(
      screen.getByTestId("workspace-close-confirm-ws-2"),
    ).toBeInTheDocument();
  });

  it("confirm_close_removes_workspace", async () => {
    seedWorkspaces();
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);

    await user.click(screen.getByTestId("workspace-switcher-trigger"));
    await user.click(screen.getByTestId("workspace-close-ws-2"));
    await user.click(screen.getByTestId("workspace-close-confirm-ws-2"));

    expect(mockIpc.closeWorkspace).toHaveBeenCalledWith("ws-2");
  });

  it("escape_closes_popover", async () => {
    seedWorkspaces();
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);

    await user.click(screen.getByTestId("workspace-switcher-trigger"));
    expect(
      screen.getByTestId("workspace-switcher-popover"),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(
        screen.queryByTestId("workspace-switcher-popover"),
      ).not.toBeInTheDocument();
    });
  });

  it("open_another_calls_prop_handler", async () => {
    seedWorkspaces();
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<WorkspaceSwitcher onOpenWorkspacePicker={onOpen} />);

    await user.click(screen.getByTestId("workspace-switcher-trigger"));
    await user.click(screen.getByTestId("workspace-open-another"));

    expect(onOpen).toHaveBeenCalled();
  });

  it("create_another_calls_prop_handler", async () => {
    seedWorkspaces();
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<WorkspaceSwitcher onOpenWorkspacePicker={onOpen} />);

    await user.click(screen.getByTestId("workspace-switcher-trigger"));
    await user.click(screen.getByTestId("workspace-create-another"));

    expect(onOpen).toHaveBeenCalled();
  });

  it("outside_click_closes_popover", async () => {
    seedWorkspaces();
    const user = userEvent.setup();
    render(
      <div>
        <WorkspaceSwitcher />
        <div data-testid="outside">outside</div>
      </div>,
    );

    await user.click(screen.getByTestId("workspace-switcher-trigger"));
    expect(
      screen.getByTestId("workspace-switcher-popover"),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("outside"));
    await waitFor(() => {
      expect(
        screen.queryByTestId("workspace-switcher-popover"),
      ).not.toBeInTheDocument();
    });
  });
});
