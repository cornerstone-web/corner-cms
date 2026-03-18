import { describe, it, expect } from "vitest";
import { generateHomeBlocks } from "../home-gen";

describe("generateHomeBlocks", () => {
  it("first block is always hero", () => {
    const blocks = generateHomeBlocks({});
    expect((blocks[0] as any).type).toBe("hero");
  });

  it("last block is always cta", () => {
    const blocks = generateHomeBlocks({});
    expect((blocks[blocks.length - 1] as any).type).toBe("cta");
  });

  it("adds image-marquee when marqueeImages provided", () => {
    const blocks = generateHomeBlocks({ marqueeImages: ["a.jpg", "b.jpg"] });
    expect(blocks.some((b: any) => b.type === "image-marquee")).toBe(true);
  });

  it("no image-marquee when marqueeImages is empty", () => {
    const blocks = generateHomeBlocks({ marqueeImages: [] });
    expect(blocks.some((b: any) => b.type === "image-marquee")).toBe(false);
  });

  it("no image-marquee when marqueeImages not provided", () => {
    const blocks = generateHomeBlocks({});
    expect(blocks.some((b: any) => b.type === "image-marquee")).toBe(false);
  });

  it("adds sermon-grid when sermons enabled", () => {
    const blocks = generateHomeBlocks({ sermons: true });
    expect(blocks.some((b: any) => b.type === "sermon-grid")).toBe(true);
  });

  it("adds event-list when events enabled", () => {
    const blocks = generateHomeBlocks({ events: true });
    expect(blocks.some((b: any) => b.type === "event-list")).toBe(true);
  });

  it("adds article-grid when articles enabled", () => {
    const blocks = generateHomeBlocks({ articles: true });
    expect(blocks.some((b: any) => b.type === "article-grid")).toBe(true);
  });

  it("adds ministry-links when ministries enabled", () => {
    const blocks = generateHomeBlocks({ ministries: true });
    expect(blocks.some((b: any) => b.type === "ministry-links")).toBe(true);
  });

  it("adds video-embed when streaming enabled", () => {
    const blocks = generateHomeBlocks({ streaming: true, channelId: "UC123" });
    expect(blocks.some((b: any) => b.type === "video-embed")).toBe(true);
  });
});
