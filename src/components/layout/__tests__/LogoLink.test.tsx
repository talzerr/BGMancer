// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { LogoLink } from "../LogoLink";

vi.mock("next/image", () => ({
  default: ({ alt, ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img alt={alt} data-testid="logo-img" {...rest} />
  ),
}));

describe("LogoLink", () => {
  it("should render a link with logo image and text", () => {
    const { container } = render(<LogoLink />);
    const link = container.querySelector("a");
    expect(link).toHaveAttribute("href", "/");
    expect(container.querySelector("[data-testid='logo-img']")).toBeInTheDocument();
    expect(container.textContent).toContain("BGMancer");
  });
});
