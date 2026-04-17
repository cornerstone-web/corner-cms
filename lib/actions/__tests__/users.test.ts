import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub out server-only dependencies that can't run in Vitest's Node environment
vi.mock("@/lib/auth", () => ({ getAuth: vi.fn() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({
  sitesTable: {},
  configTable: {},
  usersTable: {},
  userSiteRolesTable: {},
  userSiteScopesTable: {},
}));
vi.mock("@/lib/auth0Management", () => ({ getAuth0ManagementToken: vi.fn() }));
vi.mock("@/lib/utils/access-control", () => ({
  isValidScope: vi.fn().mockReturnValue(true),
  filterValidScopes: vi.fn((scopes: string[]) => scopes),
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

import { resolveInviteEmailStatus } from "@/lib/utils/invite";
import { removeUserFromSite, updateUserAccess, inviteUser } from "@/lib/actions/users";
import { getAuth } from "@/lib/auth";
import { isValidScope } from "@/lib/utils/access-control";
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

describe("removeUserFromSite", () => {
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
      siteAssignment: { siteId: "church-1", isAdmin: true },
    },
  };

  function setupDbMocks(findFirstResult: typeof mockUser | null) {
    (db as any).query = {
      usersTable: { findFirst: vi.fn().mockResolvedValue(findFirstResult) },
      userSiteRolesTable: { findFirst: vi.fn().mockResolvedValue({ id: "role-1" }) },
    };
    (db as any).update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    (db as any).delete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
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

    const result = await removeUserFromSite("church-1", "user-1");

    expect(result).toEqual({ ok: true });
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

    const result = await removeUserFromSite("church-1", "user-1");

    expect(result).toEqual({ ok: true });
  });

  it("user not found in DB: returns { ok: false, error: /not found/i }", async () => {
    vi.mocked(getAuth).mockResolvedValue(adminAuthResult as any);
    setupDbMocks(null);

    const result = await removeUserFromSite("church-1", "user-1");

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

    const result = await removeUserFromSite("church-1", "user-1");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/500/);
  });

  it("permission denied: non-admin for a different church returns { ok: false, error: /permission/i }", async () => {
    vi.mocked(getAuth).mockResolvedValue({
      user: {
        isSuperAdmin: false,
        siteAssignment: { siteId: "other-church", isAdmin: false },
      },
    } as any);

    const result = await removeUserFromSite("church-1", "user-1");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/permission/i);
  });
});

describe("updateUserAccess", () => {
  const adminAuthResult = {
    user: {
      isSuperAdmin: false,
      siteAssignment: { siteId: "church-1", isAdmin: true },
    },
  };

  function setupDbMocks() {
    (db as any).update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    (db as any).delete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    (db as any).insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db as any).query = {
      sitesTable: {
        findFirst: vi.fn().mockResolvedValue({ githubRepoName: "org/repo" }),
      },
      configTable: {
        findFirst: vi.fn().mockResolvedValue({
          object: JSON.stringify({ content: [{ type: "collection", name: "sermons" }] }),
        }),
      },
      userSiteRolesTable: {
        findFirst: vi.fn().mockResolvedValue({ id: "role-1" }),
      },
    };
  }

  beforeEach(() => {
    vi.mocked(getAuth).mockResolvedValue(adminAuthResult as any);
    vi.mocked(isValidScope).mockReturnValue(true);
    setupDbMocks();
  });

  it("returns error when caller does not have permission", async () => {
    vi.mocked(getAuth).mockResolvedValueOnce({
      user: {
        isSuperAdmin: false,
        siteAssignment: { siteId: "other-church", isAdmin: false },
      },
    } as any);
    const result = await updateUserAccess("church-1", "user-1", false, ["collection:sermons"]);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/permission/i) });
  });

  it("returns error when userId is not a member of siteId", async () => {
    (db as any).query.userSiteRolesTable.findFirst = vi.fn().mockResolvedValue(null);
    const result = await updateUserAccess("church-1", "user-99", false, ["collection:sermons"]);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/not a member/i) });
  });

  it("returns error for invalid scopes", async () => {
    vi.mocked(isValidScope).mockReturnValueOnce(false);
    const result = await updateUserAccess("church-1", "user-1", false, ["invalid:scope"]);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/invalid scopes/i) });
  });

  it("returns error for non-admin with empty scopes", async () => {
    const result = await updateUserAccess("church-1", "user-1", false, []);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/at least one scope/i) });
  });

  it("returns ok and clears scopes when promoting to admin", async () => {
    const result = await updateUserAccess("church-1", "user-1", true, []);
    expect(result).toEqual({ ok: true });
    expect((db as any).delete).toHaveBeenCalled();
    expect((db as any).insert).not.toHaveBeenCalled();
  });

  it("returns ok and upserts scopes for non-admin", async () => {
    const result = await updateUserAccess("church-1", "user-1", false, ["collection:sermons"]);
    expect(result).toEqual({ ok: true });
    expect((db as any).insert).toHaveBeenCalled();
  });
});

describe("inviteUser – empty scopes guard", () => {
  beforeEach(() => {
    vi.mocked(getAuth).mockResolvedValue({
      user: { isSuperAdmin: true, siteAssignment: null },
    } as any);
    (db as any).query = {
      sitesTable: {
        findFirst: vi.fn().mockResolvedValue({ githubRepoName: "org/repo" }),
      },
      configTable: {
        findFirst: vi.fn().mockResolvedValue({
          object: JSON.stringify({ content: [{ type: "collection", name: "sermons" }, { type: "collection", name: "pages" }] }),
        }),
      },
    };
  });

  it("returns error when non-admin invite has no scopes", async () => {
    const formData = new FormData();
    formData.set("siteId", "church-1");
    formData.set("name", "Jane");
    formData.set("email", "jane@test.com");
    formData.set("isAdmin", "false");
    formData.set("scopes", "[]");

    const result = await inviteUser({ status: "idle" }, formData);
    expect(result.status).toBe("error");
    expect((result as any).message).toMatch(/at least one scope/i);
  });
});
