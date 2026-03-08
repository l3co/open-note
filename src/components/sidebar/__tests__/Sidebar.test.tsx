import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Sidebar } from "../Sidebar";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@/components/sidebar/NotebookTree", () => ({
  NotebookTree: () => <div data-testid="notebook-tree">Tree</div>,
}));
vi.mock("@/components/sidebar/SidebarFooter", () => ({
  SidebarFooter: () => <div data-testid="sidebar-footer-mock">Footer</div>,
}));

describe("Sidebar", () => {
  beforeEach(() => {
    useUIStore.setState({ sidebarOpen: true, sidebarWidth: 260 });
  });

  it("renders nothing when sidebar is closed", () => {
    useUIStore.setState({ sidebarOpen: false });
    const { container } = render(<Sidebar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders sidebar when open", () => {
    render(<Sidebar />);
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("renders NotebookTree", () => {
    render(<Sidebar />);
    expect(screen.getByTestId("notebook-tree")).toBeInTheDocument();
  });

  it("renders SidebarFooter", () => {
    render(<Sidebar />);
    expect(screen.getByTestId("sidebar-footer-mock")).toBeInTheDocument();
  });

  it("renders resize handle", () => {
    render(<Sidebar />);
    expect(screen.getByTestId("sidebar-resize-handle")).toBeInTheDocument();
  });

  it("applies sidebar width from store", () => {
    useUIStore.setState({ sidebarWidth: 300 });
    render(<Sidebar />);
    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar.style.width).toBe("300px");
  });

  it("has nav with aria-label", () => {
    render(<Sidebar />);
    expect(screen.getByTestId("sidebar-nav")).toBeInTheDocument();
  });
});
