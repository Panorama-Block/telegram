import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DocumentationContent } from "@/app/documentation/documentation-content";
import {
  INTERNAL_ARCHITECTURE_PATH,
  OFFICIAL_DOCS_HOME,
} from "@/features/documentation/content";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : href?.pathname} {...props}>
      {children}
    </a>
  ),
}));

describe("DocumentationContent", () => {
  test("renders title, official docs CTA and architecture link", () => {
    render(<DocumentationContent />);

    expect(
      screen.getByRole("heading", { name: "Documentation Hub" }),
    ).toBeInTheDocument();

    const officialDocsLink = screen
      .getAllByRole("link")
      .find((element) => element.getAttribute("href") === OFFICIAL_DOCS_HOME);
    expect(officialDocsLink).toBeTruthy();

    expect(
      screen.getByRole("link", { name: "Open Architecture Diagram" }),
    ).toHaveAttribute("href", INTERNAL_ARCHITECTURE_PATH);
  });
});
