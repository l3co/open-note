import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { OnboardingDialog } from "./OnboardingDialog";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

describe("OnboardingDialog", () => {
  it("renders welcome step initially", () => {
    render(<OnboardingDialog onComplete={vi.fn()} />);
    expect(screen.getByText("Bem-vindo ao Open Note")).toBeInTheDocument();
  });

  it("shows tour step after clicking start", () => {
    render(<OnboardingDialog onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText("Começar com workspace local"));
    expect(screen.getByText("Sidebar")).toBeInTheDocument();
  });

  it("navigates through tour steps", () => {
    render(<OnboardingDialog onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText("Começar com workspace local"));
    expect(screen.getByText("Sidebar")).toBeInTheDocument();

    fireEvent.click(screen.getByText("OK"));
    expect(screen.getByText("Comandos")).toBeInTheDocument();

    fireEvent.click(screen.getByText("OK"));
    expect(screen.getByText("Modos de edição")).toBeInTheDocument();

    fireEvent.click(screen.getByText("OK"));
    expect(screen.getByText("Local-first")).toBeInTheDocument();
  });

  it("calls onComplete when finishing tour", () => {
    const onComplete = vi.fn();
    render(<OnboardingDialog onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Começar com workspace local"));
    fireEvent.click(screen.getByText("OK"));
    fireEvent.click(screen.getByText("OK"));
    fireEvent.click(screen.getByText("OK"));
    fireEvent.click(screen.getByText("Confirmar"));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("calls onComplete when skipping from welcome", () => {
    const onComplete = vi.fn();
    render(<OnboardingDialog onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Fechar"));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
