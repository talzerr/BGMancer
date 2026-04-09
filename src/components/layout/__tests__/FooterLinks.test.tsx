// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { FooterLinks } from "../FooterLinks";

describe("FooterLinks", () => {
  it("should render Source, Legal, and Discord links", () => {
    const { container } = render(<FooterLinks />);
    const links = container.querySelectorAll("a");
    const hrefs = Array.from(links).map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("https://github.com/talzerr/bgmancer");
    expect(hrefs).toContain("/legal");
    expect(container.textContent).toContain("Discord: talzxc");
  });
});
