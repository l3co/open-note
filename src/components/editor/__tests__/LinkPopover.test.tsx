import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinkPopover } from "../LinkPopover";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("LinkPopover", () => {
  const defaultProps = {
    initialUrl: "",
    onSubmit: vi.fn(),
    onRemove: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders input with initial URL", () => {
    render(<LinkPopover {...defaultProps} initialUrl="https://example.com" />);
    const input = screen.getByPlaceholderText("https://...") as HTMLInputElement;
    expect(input.value).toBe("https://example.com");
  });

  it("focuses input on mount", () => {
    render(<LinkPopover {...defaultProps} />);
    expect(screen.getByPlaceholderText("https://...")).toHaveFocus();
  });

  it("calls onSubmit with URL on Enter", async () => {
    const user = userEvent.setup();
    render(<LinkPopover {...defaultProps} />);
    await user.type(
      screen.getByPlaceholderText("https://..."),
      "https://test.com{Enter}",
    );
    expect(defaultProps.onSubmit).toHaveBeenCalledWith("https://test.com");
  });

  it("calls onClose on Escape", async () => {
    const user = userEvent.setup();
    render(<LinkPopover {...defaultProps} />);
    await user.type(screen.getByPlaceholderText("https://..."), "{Escape}");
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("auto-prepends https:// when missing", async () => {
    const user = userEvent.setup();
    render(<LinkPopover {...defaultProps} />);
    await user.type(
      screen.getByPlaceholderText("https://..."),
      "example.com{Enter}",
    );
    expect(defaultProps.onSubmit).toHaveBeenCalledWith("https://example.com");
  });

  it("shows remove button only when initialUrl provided", () => {
    const { rerender } = render(<LinkPopover {...defaultProps} />);
    expect(screen.queryByTitle(/remove|remover/i)).not.toBeInTheDocument();
    rerender(<LinkPopover {...defaultProps} initialUrl="https://x.com" />);
    expect(screen.getByTitle(/remove|remover/i)).toBeInTheDocument();
  });

  it("calls onRemove when remove button clicked", async () => {
    const user = userEvent.setup();
    render(<LinkPopover {...defaultProps} initialUrl="https://x.com" />);
    await user.click(screen.getByTitle(/remove|remover/i));
    expect(defaultProps.onRemove).toHaveBeenCalled();
  });
});
