import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTemplateStore } from "../useTemplateStore";
import { BUILTIN_TEMPLATES } from "@/lib/builtinTemplates";
import type { TemplateSummary } from "@/types/bindings/TemplateSummary";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockIpc = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  createTemplateFromPage: vi.fn(),
  deleteTemplate: vi.fn(),
  createPageFromTemplate: vi.fn(),
  createPage: vi.fn(),
  updatePageBlocks: vi.fn(),
}));

vi.mock("@/lib/ipc", () => mockIpc);

describe("useTemplateStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTemplateStore.setState({
      userTemplates: [],
      isLoading: false,
      error: null,
    });
  });

  it("loadUserTemplates populates userTemplates", async () => {
    const templates = [
      {
        id: "t1",
        name: "Template 1",
        category: "meeting",
        created_at: "2024-01-01T00:00:00Z",
        block_count: 5,
      },
    ];
    mockIpc.listTemplates.mockResolvedValue(templates);

    await useTemplateStore.getState().loadUserTemplates("ws-1");

    expect(mockIpc.listTemplates).toHaveBeenCalledWith("ws-1");
    expect(useTemplateStore.getState().userTemplates).toEqual(templates);
    expect(useTemplateStore.getState().isLoading).toBe(false);
  });

  it("createFromPage adds new template to the front of userTemplates", async () => {
    const existing = {
      id: "t1",
      name: "Old",
      category: "custom",
      created_at: "2024-01-01T00:00:00Z",
      block_count: 0,
    };
    useTemplateStore.setState({
      userTemplates: [existing] as unknown as TemplateSummary[],
    });

    const newTemplate = {
      id: "t2",
      name: "New",
      category: "meeting",
      created_at: "2024-01-02T00:00:00Z",
      block_count: 1,
    };
    mockIpc.createTemplateFromPage.mockResolvedValue(newTemplate);

    await useTemplateStore
      .getState()
      .createFromPage("page-1", "New", "Desc", "meeting");

    expect(mockIpc.createTemplateFromPage).toHaveBeenCalledWith(
      "page-1",
      "New",
      "Desc",
      "meeting",
      undefined,
    );
    expect(useTemplateStore.getState().userTemplates[0]).toEqual(newTemplate);
    expect(useTemplateStore.getState().userTemplates.length).toBe(2);
  });

  it("deleteUserTemplate removes template from state", async () => {
    const t1 = { id: "t1", name: "T1" };
    const t2 = { id: "t2", name: "T2" };
    useTemplateStore.setState({
      userTemplates: [t1, t2] as unknown as TemplateSummary[],
    });
    mockIpc.deleteTemplate.mockResolvedValue(undefined);

    await useTemplateStore.getState().deleteUserTemplate("t1");

    expect(mockIpc.deleteTemplate).toHaveBeenCalledWith("t1", undefined);
    expect(useTemplateStore.getState().userTemplates).toEqual([t2]);
  });

  it("applyUserTemplate calls IPC createPageFromTemplate", async () => {
    const page = { id: "p1", title: "New Page" };
    mockIpc.createPageFromTemplate.mockResolvedValue(page);

    const result = await useTemplateStore
      .getState()
      .applyUserTemplate("sec-1", "t1", "Custom Title");

    expect(mockIpc.createPageFromTemplate).toHaveBeenCalledWith(
      "sec-1",
      "t1",
      "Custom Title",
      undefined,
    );
    expect(result).toEqual(page);
  });

  it("applyBuiltinTemplate calls createPage and updatePageBlocks", async () => {
    const template = BUILTIN_TEMPLATES.find((t) => t.id === "builtin-meeting")!;
    const initialPage = { id: "p1", title: "Meeting" };
    const updatedPage = { id: "p1", title: "Meeting", blocks: template.blocks };

    mockIpc.createPage.mockResolvedValue(initialPage);
    mockIpc.updatePageBlocks.mockResolvedValue(updatedPage);

    const result = await useTemplateStore
      .getState()
      .applyBuiltinTemplate("sec-1", template);

    expect(mockIpc.createPage).toHaveBeenCalled();
    expect(mockIpc.updatePageBlocks).toHaveBeenCalledWith(
      "p1",
      template.blocks,
      undefined,
    );
    expect(result).toEqual(updatedPage);
  });

  it("applyBuiltinTemplate (blank) only calls createPage", async () => {
    const template = BUILTIN_TEMPLATES.find((t) => t.id === "builtin-blank")!;
    const page = { id: "p1", title: "Blank" };

    mockIpc.createPage.mockResolvedValue(page);

    const result = await useTemplateStore
      .getState()
      .applyBuiltinTemplate("sec-1", template);

    expect(mockIpc.createPage).toHaveBeenCalled();
    expect(mockIpc.updatePageBlocks).not.toHaveBeenCalled();
    expect(result).toEqual(page);
  });

  it("sets error on failure", async () => {
    mockIpc.listTemplates.mockRejectedValue(new Error("Network Error"));
    await useTemplateStore.getState().loadUserTemplates();
    expect(useTemplateStore.getState().error).toContain("Network Error");
  });
});
