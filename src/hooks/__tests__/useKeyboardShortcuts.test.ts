import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "../useKeyboardShortcuts";
import { useUIStore } from "@/stores/useUIStore";
import { useNavigationStore } from "@/stores/useNavigationStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  document.dispatchEvent(event);
}

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarOpen: true,
      showWorkspacePicker: false,
      showQuickOpen: false,
      showSearchPanel: false,
    });
    useNavigationStore.setState({
      history: [],
      historyIndex: -1,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("toggles sidebar on Cmd+\\", () => {
    renderHook(() => useKeyboardShortcuts());
    expect(useUIStore.getState().sidebarOpen).toBe(true);
    fireKey("\\", { metaKey: true });
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it("opens workspace picker on Cmd+Shift+O", () => {
    renderHook(() => useKeyboardShortcuts());
    fireKey("O", { metaKey: true, shiftKey: true });
    expect(useUIStore.getState().showWorkspacePicker).toBe(true);
  });

  it("opens quick open on Cmd+P", () => {
    renderHook(() => useKeyboardShortcuts());
    fireKey("p", { metaKey: true });
    expect(useUIStore.getState().showQuickOpen).toBe(true);
  });

  it("opens search panel on Cmd+Shift+F", () => {
    renderHook(() => useKeyboardShortcuts());
    fireKey("F", { metaKey: true, shiftKey: true });
    expect(useUIStore.getState().showSearchPanel).toBe(true);
  });

  it("navigates back on Cmd+[", () => {
    const goBack = vi.fn();
    useNavigationStore.setState({ goBack });
    renderHook(() => useKeyboardShortcuts());
    fireKey("[", { metaKey: true });
    expect(goBack).toHaveBeenCalled();
  });

  it("navigates forward on Cmd+]", () => {
    const goForward = vi.fn();
    useNavigationStore.setState({ goForward });
    renderHook(() => useKeyboardShortcuts());
    fireKey("]", { metaKey: true });
    expect(goForward).toHaveBeenCalled();
  });

  it("cleans up listener on unmount", () => {
    const spy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useKeyboardShortcuts());
    unmount();
    expect(spy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("does not toggle sidebar without meta key", () => {
    renderHook(() => useKeyboardShortcuts());
    fireKey("\\");
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });
});
