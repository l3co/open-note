import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ShortcutsSection } from "../ShortcutsSection";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("ShortcutsSection", () => {
  it("renders all shortcut keys", () => {
    render(<ShortcutsSection />);
    expect(screen.getByText("Cmd+N")).toBeInTheDocument();
    expect(screen.getByText("Cmd+Shift+N")).toBeInTheDocument();
    expect(screen.getByText("Cmd+S")).toBeInTheDocument();
    expect(screen.getByText("Cmd+P")).toBeInTheDocument();
    expect(screen.getByText("Cmd+Shift+F")).toBeInTheDocument();
    expect(screen.getByText("Cmd+Shift+M")).toBeInTheDocument();
    expect(screen.getByText("Cmd+B")).toBeInTheDocument();
    expect(screen.getByText("Cmd+I")).toBeInTheDocument();
    expect(screen.getByText("Cmd+U")).toBeInTheDocument();
    expect(screen.getByText("Cmd+K")).toBeInTheDocument();
    expect(screen.getByText("Cmd+E")).toBeInTheDocument();
    expect(screen.getByText("Cmd+,")).toBeInTheDocument();
  });

  it("renders shortcut labels", () => {
    render(<ShortcutsSection />);
    expect(screen.getByText("Nova Página")).toBeInTheDocument();
    expect(screen.getByText("Novo Notebook")).toBeInTheDocument();
  });

  it("renders kbd elements for all shortcuts", () => {
    const { container } = render(<ShortcutsSection />);
    const kbds = container.querySelectorAll("kbd");
    expect(kbds.length).toBe(12);
  });
});
