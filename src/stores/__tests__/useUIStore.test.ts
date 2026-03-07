import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../useUIStore";

describe("useUIStore", () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarOpen: true,
      sidebarWidth: 260,
      theme: { baseTheme: "system", accentColor: "Blue", chromeTint: "neutral" },
      showWorkspacePicker: false,
      showTrashPanel: false,
    });
  });

  it("toggles sidebar", () => {
    expect(useUIStore.getState().sidebarOpen).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it("clamps sidebar width between 200 and 400", () => {
    useUIStore.getState().setSidebarWidth(100);
    expect(useUIStore.getState().sidebarWidth).toBe(200);

    useUIStore.getState().setSidebarWidth(500);
    expect(useUIStore.getState().sidebarWidth).toBe(400);

    useUIStore.getState().setSidebarWidth(300);
    expect(useUIStore.getState().sidebarWidth).toBe(300);
  });

  it("sets theme partially", () => {
    useUIStore.getState().setTheme({ baseTheme: "dark" });
    const { theme } = useUIStore.getState();
    expect(theme.baseTheme).toBe("dark");
    expect(theme.accentColor).toBe("Blue");
    expect(theme.chromeTint).toBe("neutral");
  });

  it("sets full theme", () => {
    useUIStore.getState().setTheme({
      baseTheme: "paper",
      accentColor: "Purple",
      chromeTint: "tinted",
    });
    const { theme } = useUIStore.getState();
    expect(theme.baseTheme).toBe("paper");
    expect(theme.accentColor).toBe("Purple");
    expect(theme.chromeTint).toBe("tinted");
  });

  it("opens and closes workspace picker", () => {
    useUIStore.getState().openWorkspacePicker();
    expect(useUIStore.getState().showWorkspacePicker).toBe(true);
    useUIStore.getState().closeWorkspacePicker();
    expect(useUIStore.getState().showWorkspacePicker).toBe(false);
  });

  it("opens and closes trash panel", () => {
    useUIStore.getState().openTrashPanel();
    expect(useUIStore.getState().showTrashPanel).toBe(true);
    useUIStore.getState().closeTrashPanel();
    expect(useUIStore.getState().showTrashPanel).toBe(false);
  });

  it("applies theme to DOM", () => {
    useUIStore.getState().setTheme({ baseTheme: "dark" });
    useUIStore.getState().applyThemeToDOM();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("applies system theme as light when matchMedia returns false", () => {
    useUIStore.getState().setTheme({ baseTheme: "system" });
    useUIStore.getState().applyThemeToDOM();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("applies chrome tint to DOM", () => {
    useUIStore.getState().setTheme({ chromeTint: "tinted" });
    useUIStore.getState().applyThemeToDOM();
    expect(document.documentElement.getAttribute("data-chrome")).toBe("tinted");
  });
});
