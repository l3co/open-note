import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SidebarFooter } from "../SidebarFooter";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockCloseWorkspace = vi.fn().mockResolvedValue(undefined);
vi.mock("@/stores/useWorkspaceStore", () => ({
  useWorkspaceStore: () => ({
    createNotebook: vi.fn(),
    closeWorkspace: mockCloseWorkspace,
  }),
}));

const mockResetNavigation = vi.fn();
vi.mock("@/stores/useNavigationStore", () => ({
  useNavigationStore: () => ({
    reset: mockResetNavigation,
  }),
}));

describe("SidebarFooter", () => {
  beforeEach(() => {
    useUIStore.setState({
      showTrashPanel: false,
      showSettings: false,
      showWorkspacePicker: false,
    });
  });

  it("renders footer with data-testid", () => {
    render(<SidebarFooter />);
    expect(screen.getByTestId("sidebar-footer")).toBeInTheDocument();
  });

  it("renders new notebook button", () => {
    render(<SidebarFooter />);
    expect(screen.getByLabelText(/notebook|caderno/i)).toBeInTheDocument();
  });

  it("renders trash button", () => {
    render(<SidebarFooter />);
    expect(screen.getByLabelText(/trash|lixeira/i)).toBeInTheDocument();
  });

  it("renders settings button", () => {
    render(<SidebarFooter />);
    expect(screen.getByLabelText(/settings|configura/i)).toBeInTheDocument();
  });

  it("opens trash panel on trash click", async () => {
    const user = userEvent.setup();
    render(<SidebarFooter />);
    await user.click(screen.getByLabelText(/trash|lixeira/i));
    expect(useUIStore.getState().showTrashPanel).toBe(true);
  });

  it("opens settings on settings click", async () => {
    const user = userEvent.setup();
    render(<SidebarFooter />);
    await user.click(screen.getByLabelText(/settings|configura/i));
    expect(useUIStore.getState().showSettings).toBe(true);
  });

  it("opens workspace picker on workspace button click", async () => {
    const user = userEvent.setup();
    render(<SidebarFooter />);
    await user.click(screen.getByLabelText(/abrir workspace/i));
    expect(useUIStore.getState().showWorkspacePicker).toBe(true);
  });

  it("renders close workspace button", () => {
    render(<SidebarFooter />);
    expect(screen.getByLabelText(/fechar workspace/i)).toBeInTheDocument();
  });

  it("closes workspace and opens picker on close click", async () => {
    const user = userEvent.setup();
    render(<SidebarFooter />);
    await user.click(screen.getByLabelText(/fechar workspace/i));
    expect(mockCloseWorkspace).toHaveBeenCalled();
    expect(mockResetNavigation).toHaveBeenCalled();
    expect(useUIStore.getState().showWorkspacePicker).toBe(true);
  });

  it("shows create dialog on new notebook click", async () => {
    const user = userEvent.setup();
    render(<SidebarFooter />);
    await user.click(screen.getByLabelText(/notebook|caderno/i));
    expect(screen.getByTestId("create-dialog-input")).toBeInTheDocument();
  });
});
