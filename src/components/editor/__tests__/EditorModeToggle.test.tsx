import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { EditorModeToggle } from "../EditorModeToggle";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("EditorModeToggle", () => {
  it("renders both mode buttons", () => {
    render(<EditorModeToggle mode="richtext" onChange={vi.fn()} />);
    expect(screen.getByTestId("mode-richtext")).toBeInTheDocument();
    expect(screen.getByTestId("mode-markdown")).toBeInTheDocument();
  });

  it("highlights richtext when active", () => {
    render(<EditorModeToggle mode="richtext" onChange={vi.fn()} />);
    const btn = screen.getByTestId("mode-richtext");
    expect(btn.style.backgroundColor).toContain("accent");
  });

  it("highlights markdown when active", () => {
    render(<EditorModeToggle mode="markdown" onChange={vi.fn()} />);
    const btn = screen.getByTestId("mode-markdown");
    expect(btn.style.backgroundColor).toContain("accent");
  });

  it("calls onChange with richtext when richtext clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<EditorModeToggle mode="markdown" onChange={onChange} />);
    await user.click(screen.getByTestId("mode-richtext"));
    expect(onChange).toHaveBeenCalledWith("richtext");
  });

  it("calls onChange with markdown when markdown clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<EditorModeToggle mode="richtext" onChange={onChange} />);
    await user.click(screen.getByTestId("mode-markdown"));
    expect(onChange).toHaveBeenCalledWith("markdown");
  });

  it("has data-testid on container", () => {
    render(<EditorModeToggle mode="richtext" onChange={vi.fn()} />);
    expect(screen.getByTestId("editor-mode-toggle")).toBeInTheDocument();
  });
});
