import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContextMenu } from "../ContextMenu";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";
import { useNavigationStore } from "@/stores/useNavigationStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("ContextMenu", () => {
  const defaultProps = {
    x: 100,
    y: 200,
    type: "notebook" as const,
    id: "nb-1",
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      renameNotebook: vi.fn().mockResolvedValue(undefined),
      deleteNotebook: vi.fn().mockResolvedValue(undefined),
      createSection: vi.fn().mockResolvedValue(undefined),
      renameSection: vi.fn().mockResolvedValue(undefined),
      deleteSection: vi.fn().mockResolvedValue(undefined),
    });
    usePageStore.setState({
      createPage: vi.fn().mockResolvedValue({ id: "new-page" }),
      deletePage: vi.fn().mockResolvedValue(undefined),
    });
    useNavigationStore.setState({
      selectPage: vi.fn(),
    });
  });

  it("renders menu at specified position", () => {
    const { container } = render(<ContextMenu {...defaultProps} />);
    const menu = container.firstChild as HTMLElement;
    expect(menu.style.left).toBe("100px");
    expect(menu.style.top).toBe("200px");
  });

  it("shows rename option for notebook", () => {
    render(<ContextMenu {...defaultProps} />);
    expect(screen.getByText("Renomear")).toBeInTheDocument();
  });

  it("shows delete option for notebook", () => {
    render(<ContextMenu {...defaultProps} />);
    expect(screen.getByText("Excluir")).toBeInTheDocument();
  });

  it("shows 'Nova Seção' option for notebook", () => {
    render(<ContextMenu {...defaultProps} />);
    expect(screen.getByText("Nova Seção")).toBeInTheDocument();
  });

  it("shows 'Nova Página' option for section", () => {
    render(<ContextMenu {...defaultProps} type="section" id="sec-1" />);
    expect(screen.getByText("Nova Página")).toBeInTheDocument();
  });

  it("does not show rename option for page", () => {
    render(<ContextMenu {...defaultProps} type="page" id="p-1" />);
    expect(screen.queryByText("Renomear")).not.toBeInTheDocument();
  });

  it("shows delete option for page", () => {
    render(<ContextMenu {...defaultProps} type="page" id="p-1" />);
    expect(screen.getByText("Excluir")).toBeInTheDocument();
  });

  it("closes on outside click", () => {
    render(<ContextMenu {...defaultProps} />);
    fireEvent.mouseDown(document);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("closes on Escape key", () => {
    render(<ContextMenu {...defaultProps} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls deleteNotebook on delete click for notebook", async () => {
    const user = userEvent.setup();
    render(<ContextMenu {...defaultProps} />);
    await user.click(screen.getByText("Excluir"));
    expect(useWorkspaceStore.getState().deleteNotebook).toHaveBeenCalledWith(
      "nb-1",
    );
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls deleteSection on delete click for section", async () => {
    const user = userEvent.setup();
    render(<ContextMenu {...defaultProps} type="section" id="sec-1" />);
    await user.click(screen.getByText("Excluir"));
    expect(useWorkspaceStore.getState().deleteSection).toHaveBeenCalledWith(
      "sec-1",
    );
  });

  it("calls deletePage on delete click for page", async () => {
    const user = userEvent.setup();
    render(<ContextMenu {...defaultProps} type="page" id="p-1" />);
    await user.click(screen.getByText("Excluir"));
    expect(usePageStore.getState().deletePage).toHaveBeenCalledWith("p-1");
  });

  it("calls createSection on 'Nova Seção' click", async () => {
    const user = userEvent.setup();
    render(<ContextMenu {...defaultProps} />);
    await user.click(screen.getByText("Nova Seção"));
    expect(useWorkspaceStore.getState().createSection).toHaveBeenCalledWith(
      "nb-1",
      "Nova Seção",
    );
  });

  it("calls createPage on 'Nova Página' click for section", async () => {
    const user = userEvent.setup();
    render(<ContextMenu {...defaultProps} type="section" id="sec-1" />);
    await user.click(screen.getByText("Nova Página"));
    expect(usePageStore.getState().createPage).toHaveBeenCalledWith(
      "sec-1",
      "Nova Página",
    );
  });

  it("shows rename input on rename click", async () => {
    const user = userEvent.setup();
    render(<ContextMenu {...defaultProps} />);
    await user.click(screen.getByText("Renomear"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("submits rename on Enter", async () => {
    const user = userEvent.setup();
    render(<ContextMenu {...defaultProps} />);
    await user.click(screen.getByText("Renomear"));
    await user.type(screen.getByRole("textbox"), "New Name{Enter}");
    expect(useWorkspaceStore.getState().renameNotebook).toHaveBeenCalledWith(
      "nb-1",
      "New Name",
    );
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("submits rename for section on Enter", async () => {
    const user = userEvent.setup();
    render(<ContextMenu {...defaultProps} type="section" id="sec-1" />);
    await user.click(screen.getByText("Renomear"));
    await user.type(screen.getByRole("textbox"), "New Sec{Enter}");
    expect(useWorkspaceStore.getState().renameSection).toHaveBeenCalledWith(
      "sec-1",
      "New Sec",
    );
  });

  it("closes rename on Escape", async () => {
    const user = userEvent.setup();
    render(<ContextMenu {...defaultProps} />);
    await user.click(screen.getByText("Renomear"));
    await user.type(screen.getByRole("textbox"), "{Escape}");
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("does not submit rename if empty", async () => {
    const user = userEvent.setup();
    render(<ContextMenu {...defaultProps} />);
    await user.click(screen.getByText("Renomear"));
    fireEvent.blur(screen.getByRole("textbox"));
    expect(
      useWorkspaceStore.getState().renameNotebook,
    ).not.toHaveBeenCalled();
  });

  it("cleans up event listeners on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<ContextMenu {...defaultProps} />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeSpy.mockRestore();
  });
});
