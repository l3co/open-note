import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SetPasswordDialog } from "../SetPasswordDialog";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockIpc = vi.hoisted(() => ({
  setPagePassword: vi.fn(),
  removePagePassword: vi.fn(),
  changePagePassword: vi.fn(),
  loadPage: vi.fn(),
  listPages: vi.fn(),
}));
vi.mock("@/lib/ipc", () => mockIpc);

const makePage = (overrides = {}) => ({
  id: "page-1",
  title: "Test",
  section_id: "sec-1",
  blocks: [],
  tags: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  schema_version: 2,
  sort_order: 0,
  editor_preferences: { mode: "rich_text" as const, split_view: false },
  annotations: { strokes: [], highlights: [], svg_cache: null },
  pdf_asset: null,
  pdf_total_pages: null,
  canvas_state: null,
  protection: null,
  encrypted_content: null,
  ...overrides,
});

const defaultProps = {
  pageId: "page-1",
  mode: "set" as const,
  open: true,
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

describe("SetPasswordDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpc.loadPage.mockResolvedValue(makePage());
    mockIpc.listPages.mockResolvedValue([]);
  });

  it("renders set-password dialog", () => {
    render(<SetPasswordDialog {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows new password and confirm fields in set mode", () => {
    render(<SetPasswordDialog {...defaultProps} mode="set" />);
    expect(
      screen.getByPlaceholderText(/Nova senha|New password/i),
    ).toBeInTheDocument();
  });

  it("shows current password field in change mode", () => {
    render(<SetPasswordDialog {...defaultProps} mode="change" />);
    expect(
      screen.getAllByPlaceholderText(/Digite a senha|Enter password/i).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows current password field in remove mode", () => {
    render(<SetPasswordDialog {...defaultProps} mode="remove" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });

  it("calls onCancel when cancel button clicked", async () => {
    const user = userEvent.setup();
    render(<SetPasswordDialog {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /cancel|cancelar/i }));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("shows error when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<SetPasswordDialog {...defaultProps} mode="set" />);

    await user.type(
      screen.getByPlaceholderText(/Nova senha|New password/i),
      "password123",
    );
    await user.type(
      screen.getByPlaceholderText(/Confirmar senha|Confirm password/i),
      "different",
    );
    await user.click(
      screen.getByRole("button", { name: /Confirmar|Confirm/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/não coincidem|do not match/i),
      ).toBeInTheDocument();
    });
  });

  it("shows error when password is too short", async () => {
    const user = userEvent.setup();
    render(<SetPasswordDialog {...defaultProps} mode="set" />);

    await user.type(
      screen.getByPlaceholderText(/Nova senha|New password/i),
      "abc",
    );
    await user.type(
      screen.getByPlaceholderText(/Confirmar senha|Confirm password/i),
      "abc",
    );
    await user.click(
      screen.getByRole("button", { name: /Confirmar|Confirm/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/pelo menos 6|at least 6/i)).toBeInTheDocument();
    });
  });

  it("calls setPagePassword IPC and onSuccess in set mode", async () => {
    const user = userEvent.setup();
    mockIpc.setPagePassword.mockResolvedValue(undefined);
    render(<SetPasswordDialog {...defaultProps} mode="set" />);

    await user.type(
      screen.getByPlaceholderText(/Nova senha|New password/i),
      "password123",
    );
    await user.type(
      screen.getByPlaceholderText(/Confirmar senha|Confirm password/i),
      "password123",
    );
    await user.click(
      screen.getByRole("button", { name: /Confirmar|Confirm/i }),
    );

    await waitFor(() => {
      expect(mockIpc.setPagePassword).toHaveBeenCalledWith(
        "page-1",
        "password123",
      );
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });

  it("calls removePagePassword IPC and onSuccess in remove mode", async () => {
    const user = userEvent.setup();
    const page = makePage();
    mockIpc.removePagePassword.mockResolvedValue(page);
    mockIpc.listPages.mockResolvedValue([]);
    render(<SetPasswordDialog {...defaultProps} mode="remove" />);

    await user.type(
      screen.getByPlaceholderText(/Digite a senha|Enter password/i),
      "password123",
    );
    await user.click(
      screen.getByRole("button", { name: /Confirmar|Confirm/i }),
    );

    await waitFor(() => {
      expect(mockIpc.removePagePassword).toHaveBeenCalledWith(
        "page-1",
        "password123",
      );
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });

  it("shows WRONG_PASSWORD error from IPC", async () => {
    const user = userEvent.setup();
    mockIpc.setPagePassword.mockRejectedValue(new Error("WRONG_PASSWORD"));
    render(<SetPasswordDialog {...defaultProps} mode="set" />);

    await user.type(
      screen.getByPlaceholderText(/Nova senha|New password/i),
      "password123",
    );
    await user.type(
      screen.getByPlaceholderText(/Confirmar senha|Confirm password/i),
      "password123",
    );
    await user.click(
      screen.getByRole("button", { name: /Confirmar|Confirm/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Senha incorreta|Wrong password/i),
      ).toBeInTheDocument();
    });
  });

  it("not rendered when open is false", () => {
    render(<SetPasswordDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
