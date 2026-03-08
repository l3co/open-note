import { describe, it, expect } from "vitest";
import {
  getAccentPalette,
  applyAccentColor,
  applyBaseTheme,
  applyChromeTint,
  ACCENT_PALETTES,
} from "../theme";

describe("theme", () => {
  it("returns default palette for unknown name", () => {
    const palette = getAccentPalette("NonExistent");
    expect(palette.name).toBe("Blue");
  });

  it("returns correct palette by name", () => {
    const palette = getAccentPalette("Purple");
    expect(palette.name).toBe("Purple");
    expect(palette.hex).toBe("#8b5cf6");
  });

  it("has 10 accent palettes", () => {
    expect(ACCENT_PALETTES).toHaveLength(10);
  });

  it("applyBaseTheme sets data-theme attribute", () => {
    applyBaseTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    applyBaseTheme("paper");
    expect(document.documentElement.getAttribute("data-theme")).toBe("paper");
  });

  it("applyBaseTheme with system uses matchMedia", () => {
    applyBaseTheme("system");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("applyChromeTint sets data-chrome attribute", () => {
    applyChromeTint("tinted");
    expect(document.documentElement.getAttribute("data-chrome")).toBe("tinted");

    applyChromeTint("neutral");
    expect(document.documentElement.getAttribute("data-chrome")).toBe(
      "neutral",
    );
  });

  it("applyAccentColor sets CSS custom properties", () => {
    const palette = getAccentPalette("Red");
    applyAccentColor(palette);
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
      "#ef4444",
    );
    expect(
      document.documentElement.style.getPropertyValue("--accent-hover"),
    ).toBe("#dc2626");
  });
});
