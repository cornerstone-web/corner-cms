import { describe, it, expect, vi, beforeEach } from "vitest";

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
import { removeUserFromChurch } from "@/lib/actions/users";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { getAuth0ManagementToken } from "@/lib/auth0Management";

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

describe("removeUserFromChurch", () => {
  const mockUser = {
    id: "user-1",
    auth0Id: "auth0|abc123",
    email: "test@example.com",
    name: "Test User",
    deletedAt: null,
  };

  const adminAuthResult = {
    user: {
      isSuperAdmin: false,
      churchAssignment: { churchId: "church-1", role: "church_admin" },
    },
  };

  function setupDbMocks(findFirstResult: typeof mockUser | null) {
    (db as any).query = {
      usersTable: { findFirst: vi.fn().mockResolvedValue(findFirstResult) },
    };
    (db as any).update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("success (204): updates db records, calls Auth0 DELETE, returns { ok: true }", async () => {
    vi.mocked(getAuth).mockResolvedValue(adminAuthResult as any);
    setupDbMocks(mockUser);
    vi.mocked(getAuth0ManagementToken).mockResolvedValue("mock-mgmt-token");
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );

    const result = await removeUserFromChurch("church-1", "user-1");

    expect(result).toEqual({ ok: true });
    expect((db as any).update).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("auth0%7Cabc123");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("Auth0 404 = success: treats already-deleted user as ok", async () => {
    vi.mocked(getAuth).mockResolvedValue(adminAuthResult as any);
    setupDbMocks(mockUser);
    vi.mocked(getAuth0ManagementToken).mockResolvedValue("mock-mgmt-token");
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("not found", { status: 404 })
    );

    const result = await removeUserFromChurch("church-1", "user-1");

    expect(result).toEqual({ ok: true });
  });

  it("user not found in DB: returns { ok: false, error: /not found/i }", async () => {
    vi.mocked(getAuth).mockResolvedValue(adminAuthResult as any);
    setupDbMocks(null);

    const result = await removeUserFromChurch("church-1", "user-1");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it("Auth0 500 = error: returns { ok: false, error: /500/ }", async () => {
    vi.mocked(getAuth).mockResolvedValue(adminAuthResult as any);
    setupDbMocks(mockUser);
    vi.mocked(getAuth0ManagementToken).mockResolvedValue("mock-mgmt-token");
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("internal server error", { status: 500 })
    );

    const result = await removeUserFromChurch("church-1", "user-1");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/500/);
  });

  it("permission denied: non-admin for a different church returns { ok: false, error: /permission/i }", async () => {
    vi.mocked(getAuth).mockResolvedValue({
      user: {
        isSuperAdmin: false,
        churchAssignment: { churchId: "other-church", role: "editor" },
      },
    } as any);

    const result = await removeUserFromChurch("church-1", "user-1");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/permission/i);
  });
});
