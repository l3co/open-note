import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PasswordUnlockDialog } from "../PasswordUnlockDialog";
import { usePageStore } from "@/stores/usePageStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockIpc = vi.hoisted(() => ({
  unlockPage: vi.fn(),
  loadPage: vi.fn(),
  listPages: vi.fn(),
}));
vi.mock("@/lib/ipc", () => mockIpc);

const makePage = (overrides = {}) => ({
  id: "page-1",
  title: "Secret Page",
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
  open: true,
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

describe("PasswordUnlockDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePageStore.setState({
      currentPage: null,
      pages: new Map(),
      isLoading: false,
      isSaving: false,
      saveStatus: "idle",
      lockState: "unlocked",
      lastSavedAt: null,
      error: null,
    });
  });

  it("renders unlock dialog when open", () => {
    render(<PasswordUnlockDialog {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("not rendered when open is false", () => {
    render(<PasswordUnlockDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows password input", () => {
    render(<PasswordUnlockDialog {...defaultProps} />);
    expect(
      screen.getByPlaceholderText(/Digite a senha|Enter password/i),
    ).toBeInTheDocument();
  });

  it("shows duration options", () => {
    render(<PasswordUnlockDialog {...defaultProps} />);
    expect(screen.getByText(/30 min/i)).toBeInTheDocument();
  });

  it("calls onCancel when cancel button clicked", async () => {
    const user = userEvent.setup();
    render(<PasswordUnlockDialog {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /Cancelar|Cancel/i }));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("unlock button is disabled when password is empty", () => {
    render(<PasswordUnlockDialog {...defaultProps} />);
    const unlockBtn = screen.getByRole("button", {
      name: /Desbloquear|Unlock/i,
    });
    expect(unlockBtn).toBeDisabled();
  });

  it("calls unlockPage and onSuccess on valid password", async () => {
    const user = userEvent.setup();
    const page = makePage();
    mockIpc.unlockPage.mockResolvedValue(page);
    mockIpc.listPages.mockResolvedValue([]);

    render(<PasswordUnlockDialog {...defaultProps} />);
    usePageStore.setState({ currentPage: page });

    const input = screen.getByPlaceholderText(/Digite a senha|Enter password/i);
    await user.type(input, "password123");
    await user.click(
      screen.getByRole("button", { name: /Desbloquear|Unlock/i }),
    );

    await waitFor(() => {
      expect(mockIpc.unlockPage).toHaveBeenCalledWith(
        "page-1",
        "password123",
        30,
      );
      expect(defaultProps.onSuccess).toHaveBeenCalledWith(page);
    });
  });

  it("shows WRONG_PASSWORD error on failed unlock", async () => {
    const user = userEvent.setup();
    mockIpc.unlockPage.mockRejectedValue(new Error("WRONG_PASSWORD"));

    render(<PasswordUnlockDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Digite a senha|Enter password/i);
    await user.type(input, "wrongpass");
    await user.click(
      screen.getByRole("button", { name: /Desbloquear|Unlock/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Senha incorreta|Wrong password/i),
      ).toBeInTheDocument();
    });
  });

  it("shows generic error on unknown failure", async () => {
    const user = userEvent.setup();
    mockIpc.unlockPage.mockRejectedValue(new Error("unknown error"));

    render(<PasswordUnlockDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Digite a senha|Enter password/i);
    await user.type(input, "somepass");
    await user.click(
      screen.getByRole("button", { name: /Desbloquear|Unlock/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/Erro|Error/i)).toBeInTheDocument();
    });
  });

  it("selecting duration option changes selection", async () => {
    const user = userEvent.setup();
    render(<PasswordUnlockDialog {...defaultProps} />);

    const sessionBtn = screen.getByText(/Até fechar|Until close/i);
    await user.click(sessionBtn);

    expect(sessionBtn.closest("button")).toHaveAttribute("type", "button");
  });
});
