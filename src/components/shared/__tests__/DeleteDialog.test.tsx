import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteDialog } from "../DeleteDialog";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("DeleteDialog", () => {
  const defaultProps = {
    itemType: "notebook" as const,
    itemName: "My Notebook",
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog with delete title", () => {
    render(<DeleteDialog {...defaultProps} />);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("shows item name in confirmation text", () => {
    render(<DeleteDialog {...defaultProps} />);
    expect(screen.getByText(/My Notebook/)).toBeInTheDocument();
  });

  it("calls onCancel when cancel button clicked", async () => {
    const user = userEvent.setup();
    render(<DeleteDialog {...defaultProps} />);
    await user.click(screen.getByTestId("delete-dialog-cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("calls onConfirm when confirm button clicked", async () => {
    const user = userEvent.setup();
    render(<DeleteDialog {...defaultProps} />);
    await user.click(screen.getByTestId("delete-dialog-confirm"));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it("calls onCancel when backdrop clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<DeleteDialog {...defaultProps} />);
    const backdrop = container.firstChild as HTMLElement;
    await user.click(backdrop);
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("renders for section type", () => {
    render(<DeleteDialog {...defaultProps} itemType="section" />);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("renders for page type", () => {
    render(<DeleteDialog {...defaultProps} itemType="page" />);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("disables confirm button while submitting", async () => {
    const user = userEvent.setup();
    defaultProps.onConfirm.mockImplementation(
      () => new Promise((r) => setTimeout(r, 100)),
    );
    render(<DeleteDialog {...defaultProps} />);
    await user.click(screen.getByTestId("delete-dialog-confirm"));
    expect(screen.getByTestId("delete-dialog-confirm")).toBeDisabled();
  });
});
