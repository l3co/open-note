import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Toolbar } from "../Toolbar";
import { useUIStore } from "@/stores/useUIStore";
import { useNavigationStore } from "@/stores/useNavigationStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("Toolbar", () => {
  beforeEach(() => {
    useUIStore.setState({ sidebarOpen: true });
    useNavigationStore.setState({
      historyIndex: -1,
      history: [],
      selectedNotebookId: null,
      selectedSectionId: null,
      selectedPageId: null,
    });
  });

  it("renders toolbar with data-testid", () => {
    render(<Toolbar />);
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
  });

  it("renders toggle sidebar button", () => {
    render(<Toolbar />);
    expect(screen.getByLabelText("Alternar sidebar")).toBeInTheDocument();
  });

  it("toggles sidebar on click", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    await user.click(screen.getByLabelText("Alternar sidebar"));
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it("renders back and forward buttons", () => {
    render(<Toolbar />);
    expect(screen.getByLabelText("Back")).toBeInTheDocument();
    expect(screen.getByLabelText("Forward")).toBeInTheDocument();
  });

  it("back button is disabled when no history", () => {
    render(<Toolbar />);
    expect(screen.getByLabelText("Back")).toBeDisabled();
  });

  it("forward button is disabled when at end of history", () => {
    render(<Toolbar />);
    expect(screen.getByLabelText("Forward")).toBeDisabled();
  });

  it("renders breadcrumb area", () => {
    render(<Toolbar />);
    expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
  });
});
