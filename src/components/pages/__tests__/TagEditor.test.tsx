import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TagEditor } from "../TagEditor";
import { usePageStore } from "@/stores/usePageStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockIpc = vi.hoisted(() => ({
  listAllTags: vi.fn(),
}));
vi.mock("@/lib/ipc", () => mockIpc);

const makePage = () => ({
  id: "page-1",
  title: "Test",
  section_id: "sec-1",
  blocks: [],
  tags: ["existing"],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  schema_version: 1,
  editor_preferences: { mode: "rich_text" as const, split_view: false },
  annotations: { strokes: [], highlights: [], svg_cache: null },
});

describe("TagEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpc.listAllTags.mockResolvedValue([]);
    usePageStore.setState({
      currentPage: makePage(),
      updatePage: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("renders existing tags", () => {
    render(<TagEditor pageId="page-1" tags={["tag1", "tag2"]} />);
    expect(screen.getByText("tag1")).toBeInTheDocument();
    expect(screen.getByText("tag2")).toBeInTheDocument();
  });

  it("renders add tag button", () => {
    render(<TagEditor pageId="page-1" tags={[]} />);
    expect(screen.getByText("tag")).toBeInTheDocument();
  });

  it("shows input when add button clicked", async () => {
    const user = userEvent.setup();
    render(<TagEditor pageId="page-1" tags={[]} />);
    await user.click(screen.getByText("tag"));
    expect(screen.getByPlaceholderText(/nova tag/i)).toBeInTheDocument();
  });

  it("shows remove button on each tag", () => {
    render(<TagEditor pageId="page-1" tags={["tag1"]} />);
    expect(screen.getByLabelText(/remover tag tag1/i)).toBeInTheDocument();
  });

  it("calls updatePage when remove button clicked", async () => {
    const user = userEvent.setup();
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    usePageStore.setState({ updatePage: mockUpdate });
    render(<TagEditor pageId="page-1" tags={["existing"]} />);
    await user.click(screen.getByLabelText(/remover tag existing/i));
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("adds tag on Enter key", async () => {
    const user = userEvent.setup();
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    usePageStore.setState({ updatePage: mockUpdate });
    render(<TagEditor pageId="page-1" tags={[]} />);
    await user.click(screen.getByText("tag"));
    await user.type(screen.getByPlaceholderText(/nova tag/i), "newtag{Enter}");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("adds tag on comma key", async () => {
    const user = userEvent.setup();
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    usePageStore.setState({ updatePage: mockUpdate });
    render(<TagEditor pageId="page-1" tags={[]} />);
    await user.click(screen.getByText("tag"));
    await user.type(screen.getByPlaceholderText(/nova tag/i), "newtag,");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("closes input on Escape", async () => {
    const user = userEvent.setup();
    render(<TagEditor pageId="page-1" tags={[]} />);
    await user.click(screen.getByText("tag"));
    expect(screen.getByPlaceholderText(/nova tag/i)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/nova tag/i), "{Escape}");
    expect(screen.queryByPlaceholderText(/nova tag/i)).not.toBeInTheDocument();
  });

  it("fetches all tags when input shown", async () => {
    const user = userEvent.setup();
    render(<TagEditor pageId="page-1" tags={[]} />);
    await user.click(screen.getByText("tag"));
    expect(mockIpc.listAllTags).toHaveBeenCalled();
  });

  it("shows suggestions matching draft", async () => {
    const user = userEvent.setup();
    mockIpc.listAllTags.mockResolvedValue(["alpha", "beta", "gamma"]);
    render(<TagEditor pageId="page-1" tags={[]} />);
    await user.click(screen.getByText("tag"));
    await user.type(screen.getByPlaceholderText(/nova tag/i), "al");
    expect(await screen.findByText("alpha")).toBeInTheDocument();
  });

  it("does not suggest already-added tags", async () => {
    const user = userEvent.setup();
    mockIpc.listAllTags.mockResolvedValue(["existing", "other"]);
    render(<TagEditor pageId="page-1" tags={["existing"]} />);
    await user.click(screen.getByText("tag"));
    await user.type(screen.getByPlaceholderText(/nova tag/i), "ot");
    // "other" should be suggested (not already added)
    expect(await screen.findByText("other")).toBeInTheDocument();
    // Suggestions list should not contain "existing" (already a tag)
    const suggestions = screen.queryAllByRole("listitem");
    const suggestionTexts = suggestions.map((s) => s.textContent);
    expect(suggestionTexts).not.toContain("existing");
  });
});
