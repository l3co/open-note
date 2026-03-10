import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TagsPage } from "../TagsPage";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { usePageStore } from "@/stores/usePageStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockIpc = vi.hoisted(() => ({
  listAllTags: vi.fn(),
  searchPages: vi.fn(),
}));
vi.mock("@/lib/ipc", () => mockIpc);

describe("TagsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpc.listAllTags.mockResolvedValue([]);
    mockIpc.searchPages.mockResolvedValue({
      items: [],
      total: 0,
      query_time_ms: 0,
    });
    useNavigationStore.setState({ selectPage: vi.fn() });
    usePageStore.setState({ loadPage: vi.fn() });
  });

  it("renders the tags page container", async () => {
    render(<TagsPage />);
    expect(screen.getByTestId("tags-page")).toBeInTheDocument();
  });

  it("shows loading spinner initially", () => {
    mockIpc.listAllTags.mockImplementation(() => new Promise(() => {}));
    render(<TagsPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no tags exist", async () => {
    mockIpc.listAllTags.mockResolvedValue([]);
    render(<TagsPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/nenhuma tag encontrada|no tags found/i),
      ).toBeInTheDocument(),
    );
  });

  it("renders tag buttons when tags are returned", async () => {
    mockIpc.listAllTags.mockResolvedValue(["rust", "typescript", "react"]);
    render(<TagsPage />);
    await waitFor(() => expect(screen.getByText("rust")).toBeInTheDocument());
    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(screen.getByText("react")).toBeInTheDocument();
  });

  it("shows error state when listAllTags fails", async () => {
    mockIpc.listAllTags.mockRejectedValue(new Error("network error"));
    render(<TagsPage />);
    await waitFor(() =>
      expect(screen.getByText(/error_load|erro/i)).toBeInTheDocument(),
    );
  });

  it("selects a tag on click and loads notes", async () => {
    mockIpc.listAllTags.mockResolvedValue(["rust"]);
    mockIpc.searchPages.mockResolvedValue({
      items: [
        {
          page_id: "p-1",
          title: "Rust Notes",
          snippet: "",
          notebook_name: "NB",
          section_name: "Sec",
          score: 1,
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      total: 1,
      query_time_ms: 0,
    });

    render(<TagsPage />);
    await waitFor(() => expect(screen.getByText("rust")).toBeInTheDocument());

    fireEvent.click(screen.getByText("rust").closest("button")!);

    await waitFor(() =>
      expect(screen.getByText("Rust Notes")).toBeInTheDocument(),
    );
    expect(mockIpc.searchPages).toHaveBeenCalledWith({
      text: "",
      tags: ["rust"],
    });
  });

  it("deselects a tag when clicking the same tag again", async () => {
    mockIpc.listAllTags.mockResolvedValue(["rust"]);
    mockIpc.searchPages.mockResolvedValue({
      items: [],
      total: 0,
      query_time_ms: 0,
    });

    render(<TagsPage />);
    await waitFor(() => expect(screen.getByText("rust")).toBeInTheDocument());

    const tagBtn = screen.getByText("rust").closest("button")!;
    fireEvent.click(tagBtn);
    await waitFor(() => expect(mockIpc.searchPages).toHaveBeenCalled());

    fireEvent.click(tagBtn);
    await waitFor(() =>
      expect(screen.queryByText(/rust notes/i)).not.toBeInTheDocument(),
    );
  });

  it("shows empty notes message when tag has no notes", async () => {
    mockIpc.listAllTags.mockResolvedValue(["empty-tag"]);
    mockIpc.searchPages.mockResolvedValue({
      items: [],
      total: 0,
      query_time_ms: 0,
    });

    render(<TagsPage />);
    await waitFor(() =>
      expect(screen.getByText("empty-tag")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("empty-tag").closest("button")!);

    await waitFor(() =>
      expect(screen.getByText(/nenhuma nota/i)).toBeInTheDocument(),
    );
  });

  it("clicking a note card calls selectPage and loadPage", async () => {
    const mockSelectPage = vi.fn();
    const mockLoadPage = vi.fn();
    useNavigationStore.setState({ selectPage: mockSelectPage });
    usePageStore.setState({ loadPage: mockLoadPage });

    mockIpc.listAllTags.mockResolvedValue(["rust"]);
    mockIpc.searchPages.mockResolvedValue({
      items: [
        {
          page_id: "p-1",
          title: "Rust Notes",
          snippet: "",
          notebook_name: "NB",
          section_name: "Sec",
          score: 1,
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      total: 1,
      query_time_ms: 0,
    });

    render(<TagsPage />);
    await waitFor(() => expect(screen.getByText("rust")).toBeInTheDocument());
    fireEvent.click(screen.getByText("rust").closest("button")!);

    await waitFor(() =>
      expect(screen.getByText("Rust Notes")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Rust Notes").closest("button")!);

    expect(mockSelectPage).toHaveBeenCalledWith("p-1");
    expect(mockLoadPage).toHaveBeenCalledWith("p-1");
  });

  it("renders background pattern", () => {
    render(<TagsPage />);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });
});
