/* eslint-disable @next/next/no-img-element */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import Header from "@/modules/landing/header";
import Hero from "@/modules/landing/hero";
import Footer from "@/modules/landing/footer";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: any) => <img alt={alt ?? ""} {...props} />,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : href?.pathname} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("thirdweb/react", () => ({
  useActiveWallet: () => null,
  useDisconnect: () => ({ disconnect: vi.fn() }),
}));

vi.mock("@/modules/landing/banner", () => ({
  default: () => <div data-testid="landing-banner" />,
}));

describe("Landing docs entrypoints", () => {
  test("header contains a single documentation link to route", () => {
    render(<Header />);
    const docsLinks = screen.getAllByRole("link", { name: "Documentation" });
    expect(docsLinks).toHaveLength(1);
    expect(docsLinks[0]).toHaveAttribute(
      "href",
      "/documentation",
    );
  });

  test("hero does not contain documentation CTA under launch app", () => {
    render(<Hero />);
    expect(screen.queryByRole("link", { name: "Documentation" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Launch App" })).toBeInTheDocument();
  });

  test("footer contains internal hub and official docs link", () => {
    render(<Footer />);

    expect(screen.getByRole("link", { name: "Documentation" })).toHaveAttribute(
      "href",
      "/documentation",
    );
    expect(screen.getByRole("link", { name: "Official Docs" })).toHaveAttribute(
      "href",
      "https://docs.panoramablock.com/",
    );
  });
});
