import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { App } from "./App";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    if (cmd === "get_app_state") {
      return Promise.resolve({
        recent_workspaces: [],
        last_opened_workspace: null,
        global_settings: {
          theme: {
            base_theme: "system",
            accent_color: "Blue",
            chrome_tint: "neutral",
          },
          language: "en",
          window_bounds: null,
        },
      });
    }
    return Promise.resolve(null);
  }),
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", () => {
    render(<App />);
    expect(screen.getByText("Open Note")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows workspace picker when no workspace is open", async () => {
    const { container } = render(<App />);
    await vi.waitFor(
      () => {
        expect(container.querySelector("button")).toBeTruthy();
      },
      { timeout: 2000 },
    );
  });
});
