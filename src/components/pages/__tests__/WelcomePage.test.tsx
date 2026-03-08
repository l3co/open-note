import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WelcomePage } from "../WelcomePage";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("WelcomePage", () => {
  it("renders welcome message", () => {
    render(<WelcomePage />);
    expect(screen.getByText(/Open Note/i)).toBeInTheDocument();
  });

  it("renders logo image", () => {
    render(<WelcomePage />);
    expect(screen.getByAltText(/Open Note/i)).toBeInTheDocument();
  });

  it("renders keyboard shortcuts hints", () => {
    render(<WelcomePage />);
    const shortcuts = screen.getAllByText(/⌘|Cmd/i);
    expect(shortcuts.length).toBeGreaterThan(0);
  });

  it("renders background pattern", () => {
    const { container } = render(<WelcomePage />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
