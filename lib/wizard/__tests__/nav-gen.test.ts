import { describe, it, expect } from "vitest";
import { generateNav } from "../nav-gen";

describe("generateNav", () => {
  it("always includes search item", () => {
    const nav = generateNav({});
    expect(nav.items.some((i: any) => i.type === "search")).toBe(true);
  });

  it("always includes an About link", () => {
    const nav = generateNav({});
    expect(nav.items.some((i: any) => i.label === "About")).toBe(true);
  });

  it("includes Give CTA when givingUrl is set", () => {
    const nav = generateNav({ givingUrl: "https://tithe.ly/example" });
    const cta = nav.items.find((i: any) => i.type === "cta") as any;
    expect(cta?.enabled).toBe(true);
  });

  it("CTA is disabled when givingUrl is absent", () => {
    const nav = generateNav({});
    const cta = nav.items.find((i: any) => i.type === "cta") as any;
    expect(cta?.enabled).toBe(false);
  });

  it("adds Sermons/Media link when sermons enabled", () => {
    const nav = generateNav({ sermons: true });
    expect(nav.items.some((i: any) => i.label === "Media" || i.label === "Sermons")).toBe(true);
  });

  it("adds Events link when events enabled", () => {
    const nav = generateNav({ events: true });
    expect(nav.items.some((i: any) => i.label === "Events")).toBe(true);
  });

  it("returns correct desktop/mobile style", () => {
    const nav = generateNav({});
    expect(nav.desktopStyle).toBe("dropdown-columns");
    expect(nav.mobileStyle).toBe("drawer");
  });
});
