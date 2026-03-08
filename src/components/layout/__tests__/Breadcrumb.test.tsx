import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Breadcrumb } from "../Breadcrumb";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("Breadcrumb", () => {
  beforeEach(() => {
    useNavigationStore.setState({
      selectedNotebookId: null,
      selectedSectionId: null,
      selectedPageId: null,
    });
    useWorkspaceStore.setState({ notebooks: [], sections: new Map() });
    usePageStore.setState({ currentPage: null });
  });

  it("renders nothing when no notebook selected", () => {
    const { container } = render(<Breadcrumb />);
    expect(container.querySelector("nav")).toBeNull();
  });

  it("renders notebook name when notebook selected", () => {
    useNavigationStore.setState({ selectedNotebookId: "nb-1" });
    useWorkspaceStore.setState({
      notebooks: [{ id: "nb-1", name: "My Notebook" }] as never,
    });
    render(<Breadcrumb />);
    expect(screen.getByText("My Notebook")).toBeInTheDocument();
  });

  it("renders notebook > section when section selected", () => {
    useNavigationStore.setState({
      selectedNotebookId: "nb-1",
      selectedSectionId: "sec-1",
    });
    useWorkspaceStore.setState({
      notebooks: [{ id: "nb-1", name: "NB" }] as never,
      sections: new Map([
        ["nb-1", [{ id: "sec-1", name: "Section A" }] as never],
      ]),
    });
    render(<Breadcrumb />);
    expect(screen.getByText("NB")).toBeInTheDocument();
    expect(screen.getByText("Section A")).toBeInTheDocument();
  });

  it("renders full breadcrumb with page", () => {
    useNavigationStore.setState({
      selectedNotebookId: "nb-1",
      selectedSectionId: "sec-1",
      selectedPageId: "p-1",
    });
    useWorkspaceStore.setState({
      notebooks: [{ id: "nb-1", name: "NB" }] as never,
      sections: new Map([
        ["nb-1", [{ id: "sec-1", name: "Sec" }] as never],
      ]),
    });
    usePageStore.setState({
      currentPage: { title: "My Page" } as never,
    });
    render(<Breadcrumb />);
    expect(screen.getByText("NB")).toBeInTheDocument();
    expect(screen.getByText("Sec")).toBeInTheDocument();
    expect(screen.getByText("My Page")).toBeInTheDocument();
  });

  it("has aria-label for accessibility", () => {
    useNavigationStore.setState({ selectedNotebookId: "nb-1" });
    useWorkspaceStore.setState({
      notebooks: [{ id: "nb-1", name: "NB" }] as never,
    });
    render(<Breadcrumb />);
    expect(screen.getByLabelText("Breadcrumb")).toBeInTheDocument();
  });
});
