import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentArea } from "../ContentArea";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { usePageStore } from "@/stores/usePageStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@/components/pages/WelcomePage", () => ({
  WelcomePage: () => <div data-testid="welcome-page">Welcome</div>,
}));
vi.mock("@/components/pages/PageView", () => ({
  PageView: ({ page }: { page: { title: string } }) => (
    <div data-testid="page-view">{page.title}</div>
  ),
}));

describe("ContentArea", () => {
  beforeEach(() => {
    useNavigationStore.setState({ selectedPageId: null });
    usePageStore.setState({ currentPage: null, isLoading: false });
  });

  it("shows loading spinner when isLoading", () => {
    usePageStore.setState({ isLoading: true });
    render(<ContentArea />);
    expect(screen.getByTestId("content-loading")).toBeInTheDocument();
  });

  it("shows welcome page when no page selected", () => {
    render(<ContentArea />);
    expect(screen.getByTestId("welcome-page")).toBeInTheDocument();
  });

  it("shows welcome page when selectedPageId but no currentPage", () => {
    useNavigationStore.setState({ selectedPageId: "p1" });
    render(<ContentArea />);
    expect(screen.getByTestId("welcome-page")).toBeInTheDocument();
  });

  it("shows PageView when page is selected and loaded", () => {
    useNavigationStore.setState({ selectedPageId: "p1" });
    usePageStore.setState({ currentPage: { title: "Test" } as never });
    render(<ContentArea />);
    expect(screen.getByTestId("page-view")).toHaveTextContent("Test");
  });
});
