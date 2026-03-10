import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../Button";
import { Search } from "lucide-react";

describe("Button", () => {
  it("renders correctly with default props", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
  });

  it("handles clicks", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("can be disabled", () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Disabled" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("renders with a shortcut badge", () => {
    render(<Button shortcut="⌘K">Search</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Search");
    expect(button.querySelector("kbd")).toHaveTextContent("⌘K");
  });

  it("renders with a custom badge", () => {
    render(<Button badge="Coming soon">Feature</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Feature");
    expect(button).toHaveTextContent("Coming soon");
  });

  it("renders an icon properly", () => {
    render(<Button icon={<Search data-testid="search-icon" />}>Search</Button>);
    expect(screen.getByTestId("search-icon")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    const handleClick = vi.fn();
    render(
      <Button loading onClick={handleClick}>
        Loading
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Loading" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("adds custom classes, sizing, and variant logic", () => {
    render(
      <Button variant="danger" size="lg" className="my-custom-class" fullWidth>
        Danger
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Danger" });
    // Check variant
    expect(button.className).toContain("text-red-500");
    // Check size
    expect(button.className).toContain("h-10");
    expect(button.className).toContain("text-base"); // from size="lg"
    // Check fullWidth
    expect(button.className).toContain("w-full");
    // Check custom class
    expect(button.className).toContain("my-custom-class");
  });
});
