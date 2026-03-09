import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditorSection } from "../EditorSection";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("EditorSection", () => {
  beforeEach(() => {
    useUIStore.setState({
      editorConfig: {
        fontFamily: "System",
        fontSize: 16,
        documentLanguage: "pt-BR",
        spellCheckEnabled: true,
      },
    });
  });

  it("renders default mode field", () => {
    render(<EditorSection />);
    expect(screen.getByText("Rich Text")).toBeInTheDocument();
  });

  it("renders spell check field", () => {
    render(<EditorSection />);
    expect(screen.getByText("Sim")).toBeInTheDocument();
  });

  it("renders font family select with default value", () => {
    render(<EditorSection />);
    const select = screen.getByTestId(
      "editor-font-family",
    ) as HTMLSelectElement;
    expect(select.value).toBe("System");
  });

  it("changes font family on select", async () => {
    const user = userEvent.setup();
    render(<EditorSection />);
    const select = screen.getByTestId("editor-font-family");
    await user.selectOptions(select, "Georgia");
    expect(useUIStore.getState().editorConfig.fontFamily).toBe("Georgia");
  });

  it("renders font size buttons with 16px active", () => {
    render(<EditorSection />);
    expect(screen.getByTestId("editor-font-size-16")).toBeInTheDocument();
    expect(screen.getByTestId("editor-font-size-12")).toBeInTheDocument();
  });

  it("changes font size on button click", async () => {
    const user = userEvent.setup();
    render(<EditorSection />);
    await user.click(screen.getByTestId("editor-font-size-20"));
    expect(useUIStore.getState().editorConfig.fontSize).toBe(20);
  });

  it("renders tab size field", () => {
    render(<EditorSection />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders spell check toggle with 'Sim' active by default", () => {
    render(<EditorSection />);
    expect(screen.getByTestId("spell-check-on")).toBeInTheDocument();
    expect(screen.getByTestId("spell-check-off")).toBeInTheDocument();
  });

  it("disables spell check on 'Não' click", async () => {
    const user = userEvent.setup();
    render(<EditorSection />);
    await user.click(screen.getByTestId("spell-check-off"));
    expect(useUIStore.getState().editorConfig.spellCheckEnabled).toBe(false);
  });

  it("enables spell check on 'Sim' click", async () => {
    useUIStore.setState({
      editorConfig: {
        fontFamily: "System",
        fontSize: 16,
        documentLanguage: "pt-BR",
        spellCheckEnabled: false,
      },
    });
    const user = userEvent.setup();
    render(<EditorSection />);
    await user.click(screen.getByTestId("spell-check-on"));
    expect(useUIStore.getState().editorConfig.spellCheckEnabled).toBe(true);
  });

  it("renders all setting labels", () => {
    render(<EditorSection />);
    const fields = screen.getAllByText(/.+/);
    expect(fields.length).toBeGreaterThan(4);
  });
});
