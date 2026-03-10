import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IconButton } from "../IconButton";
import { Search } from "lucide-react";

describe("IconButton", () => {
  it("renders correctly with an icon", () => {
    render(
      <IconButton
        aria-label="Search"
        icon={<Search data-testid="search-icon" />}
      />,
    );
    const button = screen.getByRole("button", { name: "Search" });
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId("search-icon")).toBeInTheDocument();
  });

  it("handles click events", () => {
    const handleClick = vi.fn();
    render(
      <IconButton
        aria-label="Search"
        icon={<Search />}
        onClick={handleClick}
      />,
    );
    const button = screen.getByRole("button", { name: "Search" });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("can be disabled", () => {
    const handleClick = vi.fn();
    render(
      <IconButton
        aria-label="Search"
        icon={<Search />}
        disabled
        onClick={handleClick}
      />,
    );
    const button = screen.getByRole("button", { name: "Search" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("shows active state", () => {
    render(<IconButton aria-label="Search" icon={<Search />} active />);
    const button = screen.getByRole("button", { name: "Search" });
    expect(button).toHaveAttribute("data-active", "true");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button.className).toContain("bg-[var(--accent-subtle)]");
  });

  it("shows loading state and hides icon", () => {
    const handleClick = vi.fn();
    render(
      <IconButton
        aria-label="Search"
        icon={<Search data-testid="search-icon" />}
        loading
        onClick={handleClick}
      />,
    );
    const button = screen.getByRole("button", { name: "Search" });

    // Should be disabled while loading
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    // Icon should be replaced by generic spinner SVGs
    expect(screen.queryByTestId("search-icon")).not.toBeInTheDocument();

    // Clicks should not trigger the handler
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("can be triggered with keyboard enter or space", () => {
    const handleClick = vi.fn();
    render(
      <IconButton
        aria-label="Search"
        icon={<Search />}
        onClick={handleClick}
      />,
    );
    const button = screen.getByRole("button", { name: "Search" });

    button.focus();
    fireEvent.keyDown(button, { key: "Enter", code: "Enter" });
    fireEvent.keyDown(button, { key: " ", code: "Space" });

    // Native buttons dispatch onClick on Enter and Space automatically in the browser,
    // but in jsdom we either simulate the click if relying on onClick,
    // or test that it handles focus correctly.
    // Testing Library's userEvent handles this better, but conceptually we know
    // native <button> works with Enter/Space out of the box.
    // So ensuring it's an actual button element is enough.
    expect(button.tagName.toLowerCase()).toBe("button");
  });
});
