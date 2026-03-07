import { describe, it, expect, beforeEach } from "vitest";
import { useNavigationStore } from "../useNavigationStore";

describe("useNavigationStore", () => {
  beforeEach(() => {
    useNavigationStore.getState().reset();
  });

  it("selects notebook and auto-expands", () => {
    useNavigationStore.getState().selectNotebook("nb-1");
    const state = useNavigationStore.getState();
    expect(state.selectedNotebookId).toBe("nb-1");
    expect(state.expandedNotebooks.has("nb-1")).toBe(true);
  });

  it("selects section and auto-expands", () => {
    useNavigationStore.getState().selectSection("sec-1");
    const state = useNavigationStore.getState();
    expect(state.selectedSectionId).toBe("sec-1");
    expect(state.expandedSections.has("sec-1")).toBe(true);
  });

  it("toggles notebook expand/collapse", () => {
    const { toggleNotebook } = useNavigationStore.getState();
    toggleNotebook("nb-1");
    expect(useNavigationStore.getState().expandedNotebooks.has("nb-1")).toBe(true);
    toggleNotebook("nb-1");
    expect(useNavigationStore.getState().expandedNotebooks.has("nb-1")).toBe(false);
  });

  it("selects page and tracks history", () => {
    const { selectPage } = useNavigationStore.getState();
    selectPage("p-1");
    selectPage("p-2");
    selectPage("p-3");

    const state = useNavigationStore.getState();
    expect(state.selectedPageId).toBe("p-3");
    expect(state.history).toEqual(["p-1", "p-2", "p-3"]);
    expect(state.historyIndex).toBe(2);
  });

  it("does not duplicate same page in history", () => {
    const { selectPage } = useNavigationStore.getState();
    selectPage("p-1");
    selectPage("p-1");

    const state = useNavigationStore.getState();
    expect(state.history).toEqual(["p-1"]);
    expect(state.historyIndex).toBe(0);
  });

  it("navigates back and forward", () => {
    const store = useNavigationStore.getState();
    store.selectPage("p-1");
    store.selectPage("p-2");
    store.selectPage("p-3");

    useNavigationStore.getState().goBack();
    expect(useNavigationStore.getState().selectedPageId).toBe("p-2");

    useNavigationStore.getState().goBack();
    expect(useNavigationStore.getState().selectedPageId).toBe("p-1");

    useNavigationStore.getState().goForward();
    expect(useNavigationStore.getState().selectedPageId).toBe("p-2");
  });

  it("goBack at start does nothing", () => {
    useNavigationStore.getState().selectPage("p-1");
    useNavigationStore.getState().goBack();
    expect(useNavigationStore.getState().selectedPageId).toBe("p-1");
    expect(useNavigationStore.getState().historyIndex).toBe(0);
  });

  it("goForward at end does nothing", () => {
    useNavigationStore.getState().selectPage("p-1");
    useNavigationStore.getState().goForward();
    expect(useNavigationStore.getState().selectedPageId).toBe("p-1");
    expect(useNavigationStore.getState().historyIndex).toBe(0);
  });

  it("truncates forward history on new selection after goBack", () => {
    const store = useNavigationStore.getState();
    store.selectPage("p-1");
    store.selectPage("p-2");
    store.selectPage("p-3");

    useNavigationStore.getState().goBack();
    useNavigationStore.getState().selectPage("p-4");

    const state = useNavigationStore.getState();
    expect(state.history).toEqual(["p-1", "p-2", "p-4"]);
    expect(state.historyIndex).toBe(2);
  });

  it("reset clears everything", () => {
    const store = useNavigationStore.getState();
    store.selectNotebook("nb-1");
    store.selectSection("sec-1");
    store.selectPage("p-1");
    store.reset();

    const state = useNavigationStore.getState();
    expect(state.selectedNotebookId).toBeNull();
    expect(state.selectedSectionId).toBeNull();
    expect(state.selectedPageId).toBeNull();
    expect(state.expandedNotebooks.size).toBe(0);
    expect(state.history).toEqual([]);
  });
});
