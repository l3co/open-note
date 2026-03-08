import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EditorSection } from "../EditorSection";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("EditorSection", () => {
  it("renders default mode field", () => {
    render(<EditorSection />);
    expect(screen.getByText("Rich Text")).toBeInTheDocument();
  });

  it("renders spell check field", () => {
    render(<EditorSection />);
    expect(screen.getByText("Sim")).toBeInTheDocument();
  });

  it("renders font size field", () => {
    render(<EditorSection />);
    expect(screen.getByText("16px")).toBeInTheDocument();
  });

  it("renders tab size field", () => {
    render(<EditorSection />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders all setting labels", () => {
    render(<EditorSection />);
    const fields = screen.getAllByText(/.+/);
    expect(fields.length).toBeGreaterThan(4);
  });
});
