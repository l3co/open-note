import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SettingsDialog } from "../SettingsDialog";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("@/components/settings/GeneralSection", () => ({
  GeneralSection: () => <div data-testid="general-section">General</div>,
}));
vi.mock("@/components/settings/AppearanceSection", () => ({
  AppearanceSection: () => (
    <div data-testid="appearance-section">Appearance</div>
  ),
}));
vi.mock("@/components/settings/EditorSection", () => ({
  EditorSection: () => <div data-testid="editor-section">Editor</div>,
}));
vi.mock("@/components/settings/SyncSection", () => ({
  SyncSection: () => <div data-testid="sync-section">Sync</div>,
}));
vi.mock("@/components/settings/ShortcutsSection", () => ({
  ShortcutsSection: () => (
    <div data-testid="shortcuts-section">Shortcuts</div>
  ),
}));
vi.mock("@/components/settings/AboutSection", () => ({
  AboutSection: () => <div data-testid="about-section">About</div>,
}));

describe("SettingsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ showSettings: false });
  });

  it("renders nothing when not visible", () => {
    const { container } = render(<SettingsDialog />);
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog when visible", () => {
    useUIStore.setState({ showSettings: true });
    render(<SettingsDialog />);
    expect(screen.getByTestId("settings-dialog")).toBeInTheDocument();
  });

  it("renders all tab buttons", () => {
    useUIStore.setState({ showSettings: true });
    render(<SettingsDialog />);
    expect(screen.getByTestId("settings-tab-general")).toBeInTheDocument();
    expect(screen.getByTestId("settings-tab-appearance")).toBeInTheDocument();
    expect(screen.getByTestId("settings-tab-editor")).toBeInTheDocument();
    expect(screen.getByTestId("settings-tab-sync")).toBeInTheDocument();
    expect(screen.getByTestId("settings-tab-shortcuts")).toBeInTheDocument();
    expect(screen.getByTestId("settings-tab-about")).toBeInTheDocument();
  });

  it("shows general section by default", () => {
    useUIStore.setState({ showSettings: true });
    render(<SettingsDialog />);
    expect(screen.getByTestId("general-section")).toBeInTheDocument();
  });

  it("switches to appearance tab on click", async () => {
    useUIStore.setState({ showSettings: true });
    const user = userEvent.setup();
    render(<SettingsDialog />);
    await user.click(screen.getByTestId("settings-tab-appearance"));
    expect(screen.getByTestId("appearance-section")).toBeInTheDocument();
    expect(screen.queryByTestId("general-section")).not.toBeInTheDocument();
  });

  it("switches to editor tab on click", async () => {
    useUIStore.setState({ showSettings: true });
    const user = userEvent.setup();
    render(<SettingsDialog />);
    await user.click(screen.getByTestId("settings-tab-editor"));
    expect(screen.getByTestId("editor-section")).toBeInTheDocument();
  });

  it("switches to sync tab on click", async () => {
    useUIStore.setState({ showSettings: true });
    const user = userEvent.setup();
    render(<SettingsDialog />);
    await user.click(screen.getByTestId("settings-tab-sync"));
    expect(screen.getByTestId("sync-section")).toBeInTheDocument();
  });

  it("switches to shortcuts tab on click", async () => {
    useUIStore.setState({ showSettings: true });
    const user = userEvent.setup();
    render(<SettingsDialog />);
    await user.click(screen.getByTestId("settings-tab-shortcuts"));
    expect(screen.getByTestId("shortcuts-section")).toBeInTheDocument();
  });

  it("switches to about tab on click", async () => {
    useUIStore.setState({ showSettings: true });
    const user = userEvent.setup();
    render(<SettingsDialog />);
    await user.click(screen.getByTestId("settings-tab-about"));
    expect(screen.getByTestId("about-section")).toBeInTheDocument();
  });

  it("closes on backdrop click", async () => {
    useUIStore.setState({ showSettings: true });
    const user = userEvent.setup();
    const { container } = render(<SettingsDialog />);
    const backdrop = container.firstChild as HTMLElement;
    await user.click(backdrop);
    expect(useUIStore.getState().showSettings).toBe(false);
  });

  it("closes on X button click", async () => {
    useUIStore.setState({ showSettings: true });
    const user = userEvent.setup();
    render(<SettingsDialog />);
    await user.click(screen.getByLabelText("Fechar"));
    expect(useUIStore.getState().showSettings).toBe(false);
  });

  it("does not close when clicking inside dialog", async () => {
    useUIStore.setState({ showSettings: true });
    const user = userEvent.setup();
    render(<SettingsDialog />);
    await user.click(screen.getByTestId("settings-dialog"));
    expect(useUIStore.getState().showSettings).toBe(true);
  });
});
