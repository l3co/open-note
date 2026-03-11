import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SyncSection } from "../SyncSection";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

describe("SyncSection", () => {
  it("renders sync section title", () => {
    render(<SyncSection />);
    expect(screen.getByText(/sincroniza/i)).toBeInTheDocument();
  });

  it("renders cloud icon", () => {
    const { container } = render(<SyncSection />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders container with proper styling", () => {
    const { container } = render(<SyncSection />);
    const wrapper = container.querySelector(".space-y-4");
    expect(wrapper).toBeInTheDocument();
  });
});
