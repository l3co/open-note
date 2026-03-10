import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFocusedWorkspace } from "@/hooks/useFocusedWorkspace";
import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";

const makeWorkspace = (id: string, name: string) => ({
  id,
  name,
  root_path: `/tmp/${name}`,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  settings: {
    default_notebook_id: null,
    auto_save_interval_ms: BigInt(2000),
    sidebar_width: 260,
    sidebar_open: true,
    last_opened_page_id: null,
  },
});

const makeNotebook = (id: string, name: string) => ({
  id,
  name,
  color: null,
  icon: null,
  order: 0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
});

const makeSection = (id: string, nbId: string, name: string) => ({
  id,
  notebook_id: nbId,
  name,
  color: null,
  order: 0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
});

const defaultNavigation = () => ({
  activeView: "home" as const,
  selectedNotebookId: null,
  selectedSectionId: null,
  selectedPageId: null,
  expandedNotebooks: new Set<string>(),
  expandedSections: new Set<string>(),
  history: [],
  historyIndex: -1,
});

describe("useFocusedWorkspace", () => {
  beforeEach(() => {
    useMultiWorkspaceStore.setState({
      workspaces: new Map(),
      focusedWorkspaceId: null,
    });
  });

  it("returns null workspace when nothing is focused", () => {
    const { result } = renderHook(() => useFocusedWorkspace());
    expect(result.current.workspaceId).toBeNull();
    expect(result.current.workspace).toBeNull();
    expect(result.current.notebooks).toEqual([]);
    expect(result.current.sections).toEqual(new Map());
    expect(result.current.navigation).toBeNull();
  });

  it("returns focused workspace data when a workspace is focused", () => {
    const ws = makeWorkspace("ws-1", "My Workspace");
    const notebooks = [makeNotebook("nb-1", "Notebook A")];
    const sections = new Map([["nb-1", [makeSection("s-1", "nb-1", "Sec A")]]]);
    const nav = defaultNavigation();

    useMultiWorkspaceStore.setState({
      workspaces: new Map([
        ["ws-1", { workspace: ws, notebooks, sections, navigation: nav }],
      ]),
      focusedWorkspaceId: "ws-1",
    });

    const { result } = renderHook(() => useFocusedWorkspace());

    expect(result.current.workspaceId).toBe("ws-1");
    expect(result.current.workspace).toEqual(ws);
    expect(result.current.notebooks).toEqual(notebooks);
    expect(result.current.sections).toEqual(sections);
    expect(result.current.navigation).toEqual(nav);
  });

  it("returns empty defaults when focused id does not match any workspace", () => {
    useMultiWorkspaceStore.setState({
      workspaces: new Map(),
      focusedWorkspaceId: "nonexistent",
    });

    const { result } = renderHook(() => useFocusedWorkspace());

    expect(result.current.workspaceId).toBe("nonexistent");
    expect(result.current.workspace).toBeNull();
    expect(result.current.notebooks).toEqual([]);
    expect(result.current.sections).toEqual(new Map());
    expect(result.current.navigation).toBeNull();
  });

  it("returns empty notebooks array when slice has no notebooks", () => {
    const ws = makeWorkspace("ws-1", "WS");
    useMultiWorkspaceStore.setState({
      workspaces: new Map([
        [
          "ws-1",
          {
            workspace: ws,
            notebooks: [],
            sections: new Map(),
            navigation: defaultNavigation(),
          },
        ],
      ]),
      focusedWorkspaceId: "ws-1",
    });

    const { result } = renderHook(() => useFocusedWorkspace());
    expect(result.current.notebooks).toEqual([]);
  });

  it("updates when focused workspace changes", () => {
    const ws1 = makeWorkspace("ws-1", "Workspace 1");
    const ws2 = makeWorkspace("ws-2", "Workspace 2");

    useMultiWorkspaceStore.setState({
      workspaces: new Map([
        [
          "ws-1",
          {
            workspace: ws1,
            notebooks: [makeNotebook("nb-1", "NB1")],
            sections: new Map(),
            navigation: defaultNavigation(),
          },
        ],
        [
          "ws-2",
          {
            workspace: ws2,
            notebooks: [makeNotebook("nb-2", "NB2")],
            sections: new Map(),
            navigation: defaultNavigation(),
          },
        ],
      ]),
      focusedWorkspaceId: "ws-1",
    });

    const { result, rerender } = renderHook(() => useFocusedWorkspace());
    expect(result.current.workspace?.name).toBe("Workspace 1");

    useMultiWorkspaceStore.setState({ focusedWorkspaceId: "ws-2" });
    rerender();

    expect(result.current.workspace?.name).toBe("Workspace 2");
  });
});
