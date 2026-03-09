import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentArea } from "../ContentArea";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { usePageStore } from "@/stores/usePageStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@/components/pages/HomePage", () => ({
  HomePage: () => <div data-testid="home-page">Home</div>,
}));
vi.mock("@/components/pages/TagsPage", () => ({
  TagsPage: () => <div data-testid="tags-page">Tags</div>,
}));
vi.mock("@/components/pages/PageView", () => ({
  PageView: ({ page }: { page: { title: string } }) => (
    <div data-testid="page-view">{page.title}</div>
  ),
}));

describe("ContentArea", () => {
  beforeEach(() => {
    useNavigationStore.setState({
      activeView: "home",
      selectedPageId: null,
    });
    usePageStore.setState({ currentPage: null, isLoading: false });
  });

  it("shows loading spinner when isLoading", () => {
    usePageStore.setState({ isLoading: true });
    render(<ContentArea />);
    expect(screen.getByTestId("content-loading")).toBeInTheDocument();
  });

  it("shows home page when activeView is home", () => {
    render(<ContentArea />);
    expect(screen.getByTestId("home-page")).toBeInTheDocument();
  });

  it("shows home page when no page selected and view is page", () => {
    useNavigationStore.setState({ activeView: "page", selectedPageId: null });
    render(<ContentArea />);
    expect(screen.getByTestId("home-page")).toBeInTheDocument();
  });

  it("shows tags page when activeView is tags", () => {
    useNavigationStore.setState({ activeView: "tags" });
    render(<ContentArea />);
    expect(screen.getByTestId("tags-page")).toBeInTheDocument();
  });

  it("shows PageView when page is selected and loaded", () => {
    useNavigationStore.setState({ activeView: "page", selectedPageId: "p1" });
    usePageStore.setState({ currentPage: { title: "Test" } as never });
    render(<ContentArea />);
    expect(screen.getByTestId("page-view")).toHaveTextContent("Test");
  });
});
