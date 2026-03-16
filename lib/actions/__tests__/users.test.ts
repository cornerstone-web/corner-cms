import { describe, it, expect, vi } from "vitest";

// Stub out server-only dependencies that can't run in Vitest's Node environment
vi.mock("@/lib/auth", () => ({ getAuth: vi.fn() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({
  churchesTable: {},
  usersTable: {},
  userChurchRolesTable: {},
}));
vi.mock("@/lib/auth0Management", () => ({ getAuth0ManagementToken: vi.fn() }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

import { resolveInviteEmailStatus } from "@/lib/utils/invite";

describe("resolveInviteEmailStatus", () => {
  it("returns emailSent: true when email succeeded", () => {
    expect(resolveInviteEmailStatus(true)).toEqual({ status: "success", emailSent: true });
  });

  it("returns emailSent: false (not an error) when email failed", () => {
    const result = resolveInviteEmailStatus(false);
    expect(result.status).toBe("success");
    expect(result.emailSent).toBe(false);
  });
});
