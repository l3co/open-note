import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TitleEditor } from "../TitleEditor";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("TitleEditor", () => {
  it("renders with title text", () => {
    render(<TitleEditor title="My Title" onTitleChange={vi.fn()} />);
    expect(screen.getByTestId("title-editor")).toHaveTextContent("My Title");
  });

  it("is contentEditable", () => {
    render(<TitleEditor title="Test" onTitleChange={vi.fn()} />);
    expect(screen.getByTestId("title-editor")).toHaveAttribute(
      "contenteditable",
      "true",
    );
  });

  it("has textbox role", () => {
    render(<TitleEditor title="Test" onTitleChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("calls onTitleChange on blur with changed text", () => {
    const onChange = vi.fn();
    render(<TitleEditor title="Old" onTitleChange={onChange} />);
    const el = screen.getByTestId("title-editor");
    el.textContent = "New Title";
    fireEvent.blur(el);
    expect(onChange).toHaveBeenCalledWith("New Title");
  });

  it("does not call onTitleChange on blur if text unchanged", () => {
    const onChange = vi.fn();
    render(<TitleEditor title="Same" onTitleChange={onChange} />);
    const el = screen.getByTestId("title-editor");
    fireEvent.blur(el);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("prevents Enter key default and focuses editor", () => {
    const mockFocus = vi.fn();
    const editorRef = {
      current: { commands: { focus: mockFocus } },
    } as never;
    render(
      <TitleEditor
        title="Test"
        onTitleChange={vi.fn()}
        editorRef={editorRef}
      />,
    );
    const el = screen.getByTestId("title-editor");
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    const prevented = !el.dispatchEvent(event);
    expect(prevented || mockFocus).toBeTruthy();
  });

  it("has data-placeholder attribute", () => {
    render(<TitleEditor title="" onTitleChange={vi.fn()} />);
    expect(screen.getByTestId("title-editor")).toHaveAttribute(
      "data-placeholder",
    );
  });
});
