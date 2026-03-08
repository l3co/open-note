import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppearanceSection } from "../AppearanceSection";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("AppearanceSection", () => {
  beforeEach(() => {
    useUIStore.setState({
      theme: {
        baseTheme: "light",
        accentColor: "Blue",
        chromeTint: "neutral",
      },
    });
  });

  it("renders theme buttons", () => {
    render(<AppearanceSection />);
    expect(screen.getByText("Claro")).toBeInTheDocument();
    expect(screen.getByText("Escuro")).toBeInTheDocument();
    expect(screen.getByText("Paper")).toBeInTheDocument();
    expect(screen.getByText("Sistema")).toBeInTheDocument();
  });

  it("renders accent color palette buttons", () => {
    render(<AppearanceSection />);
    expect(screen.getByLabelText("Blue")).toBeInTheDocument();
    expect(screen.getByLabelText("Purple")).toBeInTheDocument();
    expect(screen.getByLabelText("Green")).toBeInTheDocument();
  });

  it("renders chrome tint buttons", () => {
    render(<AppearanceSection />);
    expect(screen.getByText("Neutro")).toBeInTheDocument();
    expect(screen.getByText("Colorido")).toBeInTheDocument();
  });

  it("changes base theme on click", async () => {
    const user = userEvent.setup();
    render(<AppearanceSection />);
    await user.click(screen.getByText("Escuro"));
    expect(useUIStore.getState().theme.baseTheme).toBe("dark");
  });

  it("changes accent color on click", async () => {
    const user = userEvent.setup();
    render(<AppearanceSection />);
    await user.click(screen.getByLabelText("Purple"));
    expect(useUIStore.getState().theme.accentColor).toBe("Purple");
  });

  it("changes chrome tint on click", async () => {
    const user = userEvent.setup();
    render(<AppearanceSection />);
    await user.click(screen.getByText("Colorido"));
    expect(useUIStore.getState().theme.chromeTint).toBe("tinted");
  });

  it("highlights active base theme", () => {
    useUIStore.setState({
      theme: {
        baseTheme: "dark",
        accentColor: "Blue",
        chromeTint: "neutral",
      },
    });
    render(<AppearanceSection />);
    const darkBtn = screen.getByText("Escuro");
    expect(darkBtn.style.borderColor).toBe("var(--accent)");
  });

  it("highlights active chrome tint", () => {
    useUIStore.setState({
      theme: {
        baseTheme: "light",
        accentColor: "Blue",
        chromeTint: "tinted",
      },
    });
    render(<AppearanceSection />);
    const tintedBtn = screen.getByText("Colorido");
    expect(tintedBtn.style.borderColor).toBe("var(--accent)");
  });
});
