import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SaveAsTemplateDialog } from "../SaveAsTemplateDialog";
import { useTemplateStore } from "@/stores/useTemplateStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

// Mock do store
vi.mock("@/stores/useTemplateStore", () => ({
  useTemplateStore: vi.fn(),
}));

const mockCreateFromPage = vi.fn();

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  pageId: "page-1",
  pageTitleSuggestion: "My Note",
};

describe("SaveAsTemplateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTemplateStore).mockReturnValue({
      createFromPage: mockCreateFromPage,
    });
  });

  it("prefills name with pageTitleSuggestion", () => {
    render(<SaveAsTemplateDialog {...defaultProps} />);
    const input = screen.getByDisplayValue("My Note");
    expect(input).toBeInTheDocument();
  });

  it("calls createFromPage with correct data on submit", async () => {
    const user = userEvent.setup();
    mockCreateFromPage.mockResolvedValue({});

    render(<SaveAsTemplateDialog {...defaultProps} />);

    const submitBtn = screen.getByRole("button", {
      name: /Salvar template|Save template/i,
    });
    await user.click(submitBtn);

    expect(mockCreateFromPage).toHaveBeenCalledWith(
      "page-1",
      "My Note",
      null,
      "custom",
    );
  });

  it("shows image block error when IPC returns image error", async () => {
    const user = userEvent.setup();
    mockCreateFromPage.mockRejectedValue("Error: page contains image blocks");

    render(<SaveAsTemplateDialog {...defaultProps} />);

    const submitBtn = screen.getByRole("button", {
      name: /Salvar template|Save template/i,
    });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Templates com imagens não são suportados|Templates with images are not supported/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows protected page error when IPC returns protected error", async () => {
    const user = userEvent.setup();
    mockCreateFromPage.mockRejectedValue(
      "Error: cannot create template from protected page",
    );

    render(<SaveAsTemplateDialog {...defaultProps} />);

    const submitBtn = screen.getByRole("button", {
      name: /Salvar template|Save template/i,
    });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/página protegida|protected page/i),
      ).toBeInTheDocument();
    });
  });

  it("shows success state when saved successfully", async () => {
    const user = userEvent.setup();
    mockCreateFromPage.mockResolvedValue({});

    render(<SaveAsTemplateDialog {...defaultProps} />);

    const submitBtn = screen.getByRole("button", {
      name: /Salvar template|Save template/i,
    });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Sucesso|Success/i)).toBeInTheDocument();
    });
  });
});
