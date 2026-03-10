import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "../Input";
import { Search } from "lucide-react";

describe("Input", () => {
  it("renders correctly", () => {
    render(<Input placeholder="Type here" />);
    const input = screen.getByPlaceholderText("Type here");
    expect(input).toBeInTheDocument();
  });

  it("handles changes", () => {
    const handleChange = vi.fn();
    render(<Input placeholder="Type here" onChange={handleChange} />);
    const input = screen.getByPlaceholderText("Type here");
    fireEvent.change(input, { target: { value: "test" } });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("test");
  });

  it("displays an icon", () => {
    render(
      <Input
        placeholder="Search"
        icon={<Search data-testid="search-icon" />}
      />,
    );
    expect(screen.getByTestId("search-icon")).toBeInTheDocument();
  });

  it("shows error state and message", () => {
    render(
      <Input placeholder="Email" id="email" error="Invalid email address" />,
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-errormessage", "email-error");

    const errorMessage = screen.getByRole("alert");
    expect(errorMessage).toHaveTextContent("Invalid email address");
    expect(errorMessage).toHaveAttribute("id", "email-error");
  });

  it("can be disabled", () => {
    render(<Input placeholder="Disabled" disabled />);
    const input = screen.getByPlaceholderText("Disabled");
    expect(input).toBeDisabled();
    // Using CSS to style disabled states relies on classes or pseudo-classes,
    // which our JSX outputs, e.g. "opacity-60".
    // Getting the wrapper div's class name:
    const wrapper = input.parentElement;
    expect(wrapper?.className).toContain("opacity-60");
  });
});
