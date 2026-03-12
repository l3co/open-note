import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TemplatePickerModal } from "../TemplatePickerModal";
import { useTemplateStore } from "@/stores/useTemplateStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("@/stores/useTemplateStore", () => ({
  useTemplateStore: vi.fn(),
}));

vi.mock("@/stores/useWorkspaceStore", () => ({
  useWorkspaceStore: vi.fn(),
}));

const mockLoadUserTemplates = vi.fn();
const mockApplyBuiltinTemplate = vi.fn();
const mockApplyUserTemplate = vi.fn();

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  sectionId: "sec-1",
  onPageCreated: vi.fn(),
};

describe("TemplatePickerModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTemplateStore).mockReturnValue({
      userTemplates: [],
      loadUserTemplates: mockLoadUserTemplates,
      applyBuiltinTemplate: mockApplyBuiltinTemplate,
      applyUserTemplate: mockApplyUserTemplate,
      isLoading: false,
    });
    vi.mocked(useWorkspaceStore).mockReturnValue({
      workspace: { id: "ws-1" },
    });
  });

  it("renders builtin templates", () => {
    render(<TemplatePickerModal {...defaultProps} />);
    // Usando getAllByText ou sendo mais específico
    expect(
      screen.getAllByText(/Página em branco|Blank page/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Reunião|Meeting/i).length).toBeGreaterThan(0);
  });

  it("renders templates and search input", () => {
    render(<TemplatePickerModal {...defaultProps} />);

    // Verifica se os built-ins aparecem
    expect(screen.getAllByText(/Reunião|Meeting/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Diário|Journal/i).length).toBeGreaterThan(0);

    // Verifica campo de busca
    expect(screen.getByPlaceholderText(/Buscar|Search/i)).toBeInTheDocument();
  });

  it("selects a template and prefills customTitle", async () => {
    const user = userEvent.setup();
    render(<TemplatePickerModal {...defaultProps} />);

    // Seleciona o card do meeting (h4 é o título do card)
    const meetingCard = screen
      .getAllByText(/Reunião|Meeting/i)
      .find((el) => el.tagName === "H4");
    await user.click(meetingCard!);

    const titleInput = screen.getByDisplayValue(/Reunião — \d{4}-\d{2}-\d{2}/i);
    expect(titleInput).toBeInTheDocument();
  });

  it("calls applyBuiltinTemplate on submit for builtin", async () => {
    const user = userEvent.setup();
    const mockPage = { id: "new-p1", title: "New Meeting" };
    mockApplyBuiltinTemplate.mockResolvedValue(mockPage);

    render(<TemplatePickerModal {...defaultProps} />);

    const meetingCard = screen
      .getAllByText(/Reunião|Meeting/i)
      .find((el) => el.tagName === "H4");
    await user.click(meetingCard!);

    const createBtn = screen.getByRole("button", { name: /Criar|Create/i });
    await user.click(createBtn);

    expect(mockApplyBuiltinTemplate).toHaveBeenCalledWith(
      "sec-1",
      expect.objectContaining({ id: "builtin-meeting" }),
      expect.stringContaining("Reunião"),
      "ws-1",
    );
    expect(defaultProps.onPageCreated).toHaveBeenCalledWith(mockPage);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("shows user templates section when available", () => {
    vi.mocked(useTemplateStore).mockReturnValue({
      userTemplates: [
        {
          id: "ut-1",
          name: "User Template",
          category: "custom",
          block_count: 0,
        },
      ],
      loadUserTemplates: mockLoadUserTemplates,
      applyBuiltinTemplate: mockApplyBuiltinTemplate,
      applyUserTemplate: mockApplyUserTemplate,
      isLoading: false,
    });

    render(<TemplatePickerModal {...defaultProps} />);
    expect(screen.getByText(/User Template/)).toBeInTheDocument();
    // A chave usada no código é templates.actions.use_template -> "Usar template" ou "Use template"
    expect(screen.getByText(/Usar template|Use template/i)).toBeInTheDocument();
  });
});
