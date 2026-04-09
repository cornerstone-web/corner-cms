import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => ({
  db: {
    update: vi.fn(),
  },
}));
vi.mock("@/db/schema", () => ({
  churchesTable: { githubRepoName: "github_repo_name" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

import { bumpLastCmsEditAt } from "@/lib/utils/bumpLastCmsEditAt";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { churchesTable } from "@/db/schema";

describe("bumpLastCmsEditAt", () => {
  it("calls db.update with lastCmsEditAt and updatedAt for owner/repo", async () => {
    const whereMock = vi.fn().mockResolvedValue(undefined);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setMock });

    await bumpLastCmsEditAt("acme", "first-church");

    expect(db.update).toHaveBeenCalledWith(churchesTable);
    const setArg = setMock.mock.calls[0][0] as Record<string, unknown>;
    expect(setArg.lastCmsEditAt).toBeInstanceOf(Date);
    expect(setArg.updatedAt).toBeInstanceOf(Date);
    expect(eq).toHaveBeenCalledWith(churchesTable.githubRepoName, "acme/first-church");
  });
});
