import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateDialog } from "../CreateDialog";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("CreateDialog", () => {
  const defaultProps = {
    title: "Create Notebook",
    placeholder: "Notebook name",
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog with title", () => {
    render(<CreateDialog {...defaultProps} />);
    expect(screen.getByText("Create Notebook")).toBeInTheDocument();
  });

  it("renders input with placeholder", () => {
    render(<CreateDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText("Notebook name")).toBeInTheDocument();
  });

  it("focuses input on mount", () => {
    render(<CreateDialog {...defaultProps} />);
    expect(screen.getByTestId("create-dialog-input")).toHaveFocus();
  });

  it("calls onCancel when cancel button clicked", async () => {
    const user = userEvent.setup();
    render(<CreateDialog {...defaultProps} />);
    await user.click(screen.getByTestId("create-dialog-cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("calls onConfirm with trimmed name", async () => {
    const user = userEvent.setup();
    render(<CreateDialog {...defaultProps} />);
    await user.type(screen.getByTestId("create-dialog-input"), "  New Name  ");
    await user.click(screen.getByTestId("create-dialog-confirm"));
    expect(defaultProps.onConfirm).toHaveBeenCalledWith("New Name");
  });

  it("shows error when submitting empty name", async () => {
    const user = userEvent.setup();
    render(<CreateDialog {...defaultProps} />);
    await user.click(screen.getByTestId("create-dialog-confirm"));
    expect(screen.getByTestId("create-dialog-error")).toBeInTheDocument();
  });

  it("submits on Enter key", async () => {
    const user = userEvent.setup();
    render(<CreateDialog {...defaultProps} />);
    await user.type(screen.getByTestId("create-dialog-input"), "Test{Enter}");
    await vi.waitFor(() => {
      expect(defaultProps.onConfirm).toHaveBeenCalledWith("Test");
    });
  });

  it("cancels on Escape key", async () => {
    const user = userEvent.setup();
    render(<CreateDialog {...defaultProps} />);
    await user.type(screen.getByTestId("create-dialog-input"), "{Escape}");
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("clears error when typing", async () => {
    const user = userEvent.setup();
    render(<CreateDialog {...defaultProps} />);
    await user.click(screen.getByTestId("create-dialog-confirm"));
    expect(screen.getByTestId("create-dialog-error")).toBeInTheDocument();
    await user.type(screen.getByTestId("create-dialog-input"), "a");
    expect(screen.queryByTestId("create-dialog-error")).not.toBeInTheDocument();
  });

  it("calls onCancel when backdrop clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateDialog {...defaultProps} />);
    const backdrop = container.firstChild as HTMLElement;
    await user.click(backdrop);
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("shows error from onConfirm rejection", async () => {
    const user = userEvent.setup();
    defaultProps.onConfirm.mockRejectedValueOnce(new Error("Already exists"));
    render(<CreateDialog {...defaultProps} />);
    await user.type(screen.getByTestId("create-dialog-input"), "Test");
    await user.click(screen.getByTestId("create-dialog-confirm"));
    expect(await screen.findByTestId("create-dialog-error")).toHaveTextContent(
      "Already exists",
    );
  });
});
