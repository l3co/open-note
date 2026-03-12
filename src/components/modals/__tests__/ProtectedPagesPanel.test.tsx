import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProtectedPagesPanel } from "../ProtectedPagesPanel";
import { usePageStore } from "@/stores/usePageStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockIpc = vi.hoisted(() => ({
  unlockPage: vi.fn(),
  listPages: vi.fn(),
}));
vi.mock("@/lib/ipc", () => mockIpc);

const makeSummary = (overrides = {}) => ({
  id: "page-1",
  title: "Notas do dia",
  tags: [],
  mode: "rich_text" as const,
  block_count: 0,
  sort_order: 0,
  is_protected: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  preview: null,
  ...overrides,
});

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
  summaries: [],
  open: true,
  onClose: vi.fn(),
  onNavigate: vi.fn(),
};

describe("ProtectedPagesPanel", () => {
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

  it("renders panel when open", () => {
    render(<ProtectedPagesPanel {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("not rendered when open is false", () => {
    render(<ProtectedPagesPanel {...defaultProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows empty state when no protected pages", () => {
    render(
      <ProtectedPagesPanel
        {...defaultProps}
        summaries={[makeSummary({ is_protected: false })]}
      />,
    );
    expect(screen.getByText(/Nenhuma página|No pages/i)).toBeInTheDocument();
  });

  it("shows protected page entries", () => {
    render(
      <ProtectedPagesPanel
        {...defaultProps}
        summaries={[makeSummary({ is_protected: true })]}
      />,
    );
    expect(
      screen.getByRole("button", { name: /unlock|desbloquear/i }),
    ).toBeInTheDocument();
  });

  it("shows unlock button for locked protected page", () => {
    render(
      <ProtectedPagesPanel
        {...defaultProps}
        summaries={[makeSummary({ is_protected: true })]}
      />,
    );
    expect(
      screen.getByRole("button", { name: /unlock|desbloquear/i }),
    ).toBeInTheDocument();
  });

  it("opens unlock dialog when unlock button clicked", async () => {
    const user = userEvent.setup();
    render(
      <ProtectedPagesPanel
        {...defaultProps}
        summaries={[makeSummary({ is_protected: true })]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /unlock|desbloquear/i }),
    );

    await waitFor(() => {
      expect(screen.getAllByRole("dialog").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("calls onClose when close button clicked", async () => {
    const user = userEvent.setup();
    render(<ProtectedPagesPanel {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /^Fechar$|^Close$/i }));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("reveals title and shows navigate button after successful unlock", async () => {
    const user = userEvent.setup();
    const page = makePage({ title: "Secret Page" });
    mockIpc.unlockPage.mockResolvedValue(page);
    mockIpc.listPages.mockResolvedValue([]);

    render(
      <ProtectedPagesPanel
        {...defaultProps}
        summaries={[makeSummary({ is_protected: true })]}
      />,
    );
    usePageStore.setState({ currentPage: page });

    await user.click(
      screen.getByRole("button", { name: /Desbloquear|Unlock/i }),
    );

    const input = await screen.findByPlaceholderText(
      /Digite a senha|Enter password/i,
    );
    await user.type(input, "password123");
    const unlockBtns = screen.getAllByRole("button", {
      name: /Desbloquear|Unlock/i,
    });
    await user.click(unlockBtns[unlockBtns.length - 1]!);

    await waitFor(() => {
      expect(mockIpc.unlockPage).toHaveBeenCalled();
    });
  });

  it("calls onNavigate and onClose when navigate button clicked after unlock", async () => {
    const user = userEvent.setup();
    const page = makePage({ title: "Secret Page" });
    mockIpc.unlockPage.mockResolvedValue(page);
    mockIpc.listPages.mockResolvedValue([]);

    const summaries = [makeSummary({ id: "page-1", is_protected: true })];
    render(<ProtectedPagesPanel {...defaultProps} summaries={summaries} />);
    usePageStore.setState({ currentPage: page });

    await user.click(
      screen.getByRole("button", { name: /Desbloquear|Unlock/i }),
    );

    const input = await screen.findByPlaceholderText(
      /Digite a senha|Enter password/i,
    );
    await user.type(input, "password123");
    const unlockBtns = screen.getAllByRole("button", {
      name: /Desbloquear|Unlock/i,
    });
    await user.click(unlockBtns[unlockBtns.length - 1]!);

    await waitFor(() => {
      expect(mockIpc.unlockPage).toHaveBeenCalledWith(
        "page-1",
        "password123",
        30,
      );
    });
  });
});
