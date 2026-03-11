import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HomePage } from "../HomePage";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { usePageStore } from "@/stores/usePageStore";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@/assets/logo.png", () => ({ default: "logo.png" }));

const mockSelectPage = vi.fn();
const mockLoadPage = vi.fn();
const mockOpenQuickOpen = vi.fn();
const mockOpenSettings = vi.fn();

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNavigationStore.setState({
      history: [],
      selectPage: mockSelectPage,
    });
    usePageStore.setState({
      pages: new Map(),
      loadPage: mockLoadPage,
    });
    useUIStore.setState({
      openQuickOpen: mockOpenQuickOpen,
      openSettings: mockOpenSettings,
    });
  });

  it("renders home page container", () => {
    render(<HomePage />);
    expect(screen.getByTestId("home-page")).toBeInTheDocument();
  });

  it("renders logo image", () => {
    render(<HomePage />);
    expect(screen.getByAltText("Open Note")).toBeInTheDocument();
  });

  it("renders a greeting heading", () => {
    render(<HomePage />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
  });

  it("renders recent pages section heading", () => {
    render(<HomePage />);
    expect(screen.getByText(/recent/i)).toBeInTheDocument();
  });

  it("renders quick actions section heading", () => {
    render(<HomePage />);
    expect(
      screen.getByText(/ações rápidas|quick actions/i),
    ).toBeInTheDocument();
  });

  it("shows empty state when no recent pages", () => {
    render(<HomePage />);
    expect(
      screen.getByText(/nenhuma página visitada|no pages visited/i),
    ).toBeInTheDocument();
  });

  it("shows recent pages when history and pages match", () => {
    const pages = new Map([
      [
        "sec-1",
        [
          {
            id: "page-1",
            title: "My First Page",
            tags: [],
            mode: "rich_text" as const,
            block_count: 0,
            is_protected: false,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ],
      ],
    ]);
    usePageStore.setState({ pages, loadPage: mockLoadPage });
    useNavigationStore.setState({
      history: ["page-1"],
      selectPage: mockSelectPage,
    });

    render(<HomePage />);
    expect(screen.getByText("My First Page")).toBeInTheDocument();
  });

  it("shows up to 6 recent pages", () => {
    const pageList = Array.from({ length: 8 }, (_, i) => ({
      id: `page-${i}`,
      title: `Page ${i}`,
      tags: [],
      mode: "rich_text" as const,
      block_count: 0,
      is_protected: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    }));
    const pages = new Map([["sec-1", pageList]]);
    const history = pageList.map((p) => p.id);
    usePageStore.setState({ pages, loadPage: mockLoadPage });
    useNavigationStore.setState({ history, selectPage: mockSelectPage });

    render(<HomePage />);
    const pageButtons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.match(/^Page \d$/));
    expect(pageButtons.length).toBeLessThanOrEqual(6);
  });

  it("clicking a recent page calls selectPage and loadPage", () => {
    const pages = new Map([
      [
        "sec-1",
        [
          {
            id: "page-1",
            title: "My First Page",
            tags: [],
            mode: "rich_text" as const,
            block_count: 0,
            is_protected: false,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ],
      ],
    ]);
    usePageStore.setState({ pages, loadPage: mockLoadPage });
    useNavigationStore.setState({
      history: ["page-1"],
      selectPage: mockSelectPage,
    });

    render(<HomePage />);
    const pageBtn = screen.getByText("My First Page").closest("button")!;
    fireEvent.click(pageBtn);

    expect(mockSelectPage).toHaveBeenCalledWith("page-1");
    expect(mockLoadPage).toHaveBeenCalledWith("page-1");
  });

  it("clicking search quick action calls openQuickOpen", () => {
    render(<HomePage />);
    const buttons = screen.getAllByRole("button");
    const searchBtn = buttons.find((b) => b.textContent?.includes("⌘K"));
    if (searchBtn) fireEvent.click(searchBtn);
    expect(mockOpenQuickOpen).toHaveBeenCalled();
  });

  it("clicking settings quick action calls openSettings", () => {
    render(<HomePage />);
    const buttons = screen.getAllByRole("button");
    const settingsBtn = buttons.find((b) => b.textContent?.includes("⌘,"));
    if (settingsBtn) fireEvent.click(settingsBtn);
    expect(mockOpenSettings).toHaveBeenCalled();
  });

  it("renders background pattern svg", () => {
    const { container } = render(<HomePage />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});

describe("getGreetingKey (via component)", () => {
  beforeEach(() => {
    useNavigationStore.setState({ history: [], selectPage: vi.fn() });
    usePageStore.setState({ pages: new Map(), loadPage: vi.fn() });
    useUIStore.setState({ openQuickOpen: vi.fn(), openSettings: vi.fn() });
  });

  it("renders some greeting text based on time of day", () => {
    render(<HomePage />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBeTruthy();
  });
});
