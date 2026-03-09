import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrashPanel } from "../TrashPanel";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockIpc = vi.hoisted(() => ({
  listTrashItems: vi.fn(),
  restoreFromTrash: vi.fn(),
  permanentlyDelete: vi.fn(),
  emptyTrash: vi.fn(),
}));

vi.mock("@/lib/ipc", () => mockIpc);

describe("TrashPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ showTrashPanel: false });
    mockIpc.listTrashItems.mockResolvedValue([]);
  });

  it("renders nothing when not visible", () => {
    const { container } = render(<TrashPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog when visible", async () => {
    useUIStore.setState({ showTrashPanel: true });
    render(<TrashPanel />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("shows empty state when no trash items", async () => {
    useUIStore.setState({ showTrashPanel: true });
    render(<TrashPanel />);
    expect(
      await screen.findByText(/Nenhum item na lixeira/),
    ).toBeInTheDocument();
  });

  it("loads and displays trash items", async () => {
    const items = [
      {
        id: "t1",
        item_type: "page",
        original_title: "Deleted Page",
        original_path: "/nb/sec/page",
        deleted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
    ];
    mockIpc.listTrashItems.mockResolvedValue(items);
    useUIStore.setState({ showTrashPanel: true });
    render(<TrashPanel />);
    expect(await screen.findByText("Deleted Page")).toBeInTheDocument();
  });

  it("shows item count badge when items exist", async () => {
    const items = [
      {
        id: "t1",
        item_type: "page",
        original_title: "Page",
        original_path: "/p",
        deleted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
    ];
    mockIpc.listTrashItems.mockResolvedValue(items);
    useUIStore.setState({ showTrashPanel: true });
    render(<TrashPanel />);
    expect(await screen.findByText(/1/)).toBeInTheDocument();
  });

  it("closes when X button clicked", async () => {
    useUIStore.setState({ showTrashPanel: true });
    const user = userEvent.setup();
    render(<TrashPanel />);
    const closeBtn = await screen.findByLabelText(/close|fechar/i);
    await user.click(closeBtn);
    expect(useUIStore.getState().showTrashPanel).toBe(false);
  });

  it("closes when backdrop clicked", async () => {
    useUIStore.setState({ showTrashPanel: true });
    const user = userEvent.setup();
    const { container } = render(<TrashPanel />);
    await screen.findByRole("dialog");
    const backdrop = container.firstChild as HTMLElement;
    await user.click(backdrop);
    expect(useUIStore.getState().showTrashPanel).toBe(false);
  });
});
