import { describe, it, expect, vi } from "vitest";

// Stub out server-only dependencies that can't run in Vitest's Node environment
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});
vi.mock("@/lib/crypto", () => ({ decrypt: vi.fn(), encrypt: vi.fn() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({ githubInstallationTokenTable: {} }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/lib/utils/repoAccess", () => ({ verifyRepoAccess: vi.fn() }));
vi.mock("@/lib/utils/octokit", () => ({ createOctokitInstance: vi.fn() }));
vi.mock("octokit", () => ({ App: vi.fn() }));

import { slugify, yamlMerge } from "../wizard";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("First Community Church")).toBe("first-community-church");
  });
  it("removes special characters", () => {
    expect(slugify("St. John's Church!")).toBe("st-johns-church");
  });
  it("collapses multiple hyphens", () => {
    expect(slugify("Church   of   Christ")).toBe("church-of-christ");
  });
  it("trims leading/trailing hyphens", () => {
    expect(slugify("  -Church-  ")).toBe("church");
  });
});

describe("yamlMerge", () => {
  it("merges shallow keys", () => {
    const base = "name: Old\ntheme: default\n";
    const result = yamlMerge(base, { name: "New Church" });
    expect(result).toContain("name: New Church");
    expect(result).toContain("theme: default");
  });
  it("deep-merges nested objects", () => {
    const base = "contact:\n  email: old@example.com\n  phone: '555-0000'\n";
    const result = yamlMerge(base, { contact: { email: "new@example.com" } });
    expect(result).toContain("email: new@example.com");
    expect(result).toContain("555-0000");
  });
});
