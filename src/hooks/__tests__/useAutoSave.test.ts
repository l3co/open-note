import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoSave } from "@/hooks/useAutoSave";
import type { JSONContent } from "@tiptap/react";

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockDoc: JSONContent = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "test" }] }],
  };

  it("does not save immediately when content changes", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutoSave({ content: mockDoc, onSave, delayMs: 1000 }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves after debounce delay", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutoSave({ content: mockDoc, onSave, delayMs: 500 }));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(mockDoc);
  });

  it("resets debounce when content changes", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const doc1: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
    const doc2: JSONContent = {
      type: "doc",
      content: [{ type: "heading", attrs: { level: 1 } }],
    };

    const { rerender } = renderHook(
      ({ content }) => useAutoSave({ content, onSave, delayMs: 1000 }),
      { initialProps: { content: doc1 as JSONContent | null } },
    );

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(onSave).not.toHaveBeenCalled();

    rerender({ content: doc2 });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(doc2);
  });

  it("does not save when content is null", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutoSave({ content: null, onSave, delayMs: 500 }));

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not save when disabled", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useAutoSave({ content: mockDoc, onSave, delayMs: 500, enabled: false }),
    );

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("forceSave triggers immediate save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAutoSave({ content: mockDoc, onSave, delayMs: 5000 }),
    );

    await act(async () => {
      await result.current.forceSave();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
