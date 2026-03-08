import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SettingsDialog } from "./SettingsDialog";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

describe("SettingsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ showSettings: false });
  });

  it("does not render when showSettings is false", () => {
    const { container } = render(<SettingsDialog />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when showSettings is true", () => {
    useUIStore.setState({ showSettings: true });
    render(<SettingsDialog />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders all tab buttons", () => {
    useUIStore.setState({ showSettings: true });
    render(<SettingsDialog />);
    expect(screen.getAllByText("Geral").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Aparência").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Editor").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sincronização").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(
      screen.getAllByText("Atalhos de Teclado").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sobre").length).toBeGreaterThanOrEqual(1);
  });

  it("switches tabs on click", () => {
    useUIStore.setState({ showSettings: true });
    render(<SettingsDialog />);
    fireEvent.click(screen.getByText("Sobre"));
    expect(screen.getByText("Open Note")).toBeInTheDocument();
    expect(screen.getByText(/Versão/)).toBeInTheDocument();
  });

  it("closes on backdrop click", () => {
    useUIStore.setState({ showSettings: true });
    const { container } = render(<SettingsDialog />);
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(useUIStore.getState().showSettings).toBe(false);
  });

  it("closes on X button click", () => {
    useUIStore.setState({ showSettings: true });
    render(<SettingsDialog />);
    const closeBtn = screen.getByLabelText("Fechar");
    fireEvent.click(closeBtn);
    expect(useUIStore.getState().showSettings).toBe(false);
  });
});
