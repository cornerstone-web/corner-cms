import { describe, it, expect } from "vitest";
import { hasScope, isValidScope, filterValidScopes, STATIC_SCOPES, isAdminUser, hasCollectionAccess, hasMediaAccess, hasSiteConfigAccess } from "@/lib/utils/access-control";
import type { User } from "@/types/user";

const COLLECTIONS = ["pages", "sermons", "events"];

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    auth0Id: "auth0|u1",
    email: "u@test.com",
    name: "Test",
    isSuperAdmin: false,
    siteAssignment: null,
    ...overrides,
  };
}

function makeAssignment(isAdmin: boolean, scopes: string[] = []) {
  return {
    siteId: "c1",
    githubRepoName: "org/repo",
    slug: "repo",
    displayName: "Repo",
    cfPagesUrl: null,
    isAdmin,
    scopes,
  };
}

describe("hasScope", () => {
  it("super admin always has any scope", () => {
    const user = makeUser({ isSuperAdmin: true });
    expect(hasScope(user, "collection:sermons")).toBe(true);
    expect(hasScope(user, "entry:pages:youth")).toBe(true);
  });

  it("site admin (isAdmin=true) always has any scope", () => {
    const user = makeUser({ siteAssignment: makeAssignment(true) });
    expect(hasScope(user, "collection:sermons")).toBe(true);
  });

  it("user with no assignment has no scope", () => {
    const user = makeUser();
    expect(hasScope(user, "collection:sermons")).toBe(false);
  });

  it("user with explicit scope has that scope", () => {
    const user = makeUser({ siteAssignment: makeAssignment(false, ["collection:sermons"]) });
    expect(hasScope(user, "collection:sermons")).toBe(true);
  });

  it("user without the scope does not have it", () => {
    const user = makeUser({ siteAssignment: makeAssignment(false, ["collection:events"]) });
    expect(hasScope(user, "collection:sermons")).toBe(false);
  });

  it("collection scope grants access to all entries in that collection", () => {
    const user = makeUser({ siteAssignment: makeAssignment(false, ["collection:pages"]) });
    expect(hasScope(user, "entry:pages:youth-ministry")).toBe(true);
    expect(hasScope(user, "entry:pages:about")).toBe(true);
  });

  it("collection scope does NOT grant access to entries in a different collection", () => {
    const user = makeUser({ siteAssignment: makeAssignment(false, ["collection:pages"]) });
    expect(hasScope(user, "entry:sermons:first-sermon")).toBe(false);
  });

  it("explicit entry scope grants access to that entry", () => {
    const user = makeUser({ siteAssignment: makeAssignment(false, ["entry:pages:youth-ministry"]) });
    expect(hasScope(user, "entry:pages:youth-ministry")).toBe(true);
  });

  it("explicit entry scope does NOT grant access to the whole collection", () => {
    const user = makeUser({ siteAssignment: makeAssignment(false, ["entry:pages:youth-ministry"]) });
    expect(hasScope(user, "collection:pages")).toBe(false);
  });

  it("malformed stored entry scope (missing slug) does not grant access to any entry", () => {
    // "entry:pages" is 2-part — invalid — but might exist in the DB from a bug or migration.
    // It should not match a well-formed entry scope check.
    const user = makeUser({ siteAssignment: makeAssignment(false, ["entry:pages"]) });
    expect(hasScope(user, "entry:pages:about")).toBe(false);
    expect(hasScope(user, "entry:pages:youth-ministry")).toBe(false);
  });
});

describe("isValidScope", () => {
  it("valid collection scope passes when collection exists in config", () => {
    expect(isValidScope("collection:sermons", COLLECTIONS)).toBe(true);
    expect(isValidScope("collection:pages", COLLECTIONS)).toBe(true);
  });

  it("collection scope fails when collection is NOT in config", () => {
    expect(isValidScope("collection:staff", COLLECTIONS)).toBe(false);
    expect(isValidScope("collection:unknown", COLLECTIONS)).toBe(false);
  });

  it("valid site-config scopes pass", () => {
    expect(isValidScope("site-config:navigation", COLLECTIONS)).toBe(true);
    expect(isValidScope("site-config:theme", COLLECTIONS)).toBe(true);
  });

  it("invalid site-config section fails", () => {
    expect(isValidScope("site-config:unknown-section", COLLECTIONS)).toBe(false);
  });

  it("valid media scopes pass", () => {
    expect(isValidScope("media:images", COLLECTIONS)).toBe(true);
    expect(isValidScope("media:video", COLLECTIONS)).toBe(true);
  });

  it("invalid media type fails", () => {
    expect(isValidScope("media:unknown-type", COLLECTIONS)).toBe(false);
  });

  it("valid entry scope passes when collection exists in config", () => {
    expect(isValidScope("entry:pages:youth-ministry", COLLECTIONS)).toBe(true);
  });

  it("entry scope with collection NOT in config fails", () => {
    expect(isValidScope("entry:staff:john-doe", COLLECTIONS)).toBe(false);
  });

  it("entry scope missing slug fails", () => {
    expect(isValidScope("entry:pages:", COLLECTIONS)).toBe(false);
    expect(isValidScope("entry:pages", COLLECTIONS)).toBe(false);
  });

  it("invalid prefix fails", () => {
    expect(isValidScope("admin:everything", COLLECTIONS)).toBe(false);
  });
});

describe("filterValidScopes", () => {
  it("keeps scopes that match the current config", () => {
    const stored = ["collection:sermons", "site-config:theme", "media:images"];
    expect(filterValidScopes(stored, COLLECTIONS)).toEqual(stored);
  });

  it("drops collection scopes for collections no longer in config", () => {
    const stored = ["collection:sermons", "collection:staff"];
    expect(filterValidScopes(stored, COLLECTIONS)).toEqual(["collection:sermons"]);
  });

  it("drops entry scopes for collections no longer in config", () => {
    const stored = ["entry:pages:about", "entry:staff:john-doe"];
    expect(filterValidScopes(stored, COLLECTIONS)).toEqual(["entry:pages:about"]);
  });

  it("returns empty array when all stored scopes are stale", () => {
    const stored = ["collection:staff", "collection:ministries"];
    expect(filterValidScopes(stored, COLLECTIONS)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(filterValidScopes([], COLLECTIONS)).toEqual([]);
  });
});

describe("STATIC_SCOPES", () => {
  it("contains no collection scopes (those are config-driven)", () => {
    const collectionScopes = STATIC_SCOPES.filter(s => s.scope.startsWith("collection:"));
    expect(collectionScopes).toHaveLength(0);
  });

  it("has all expected site-config scopes", () => {
    const configScopes = STATIC_SCOPES.filter(s => s.scope.startsWith("site-config:"));
    expect(configScopes.map(s => s.scope)).toContain("site-config:navigation");
    expect(configScopes.map(s => s.scope)).toContain("site-config:theme");
  });

  it("has all expected media scopes", () => {
    const mediaScopes = STATIC_SCOPES.filter(s => s.scope.startsWith("media:"));
    expect(mediaScopes.map(s => s.scope)).toContain("media:images");
    expect(mediaScopes.map(s => s.scope)).toContain("media:video");
    expect(mediaScopes.map(s => s.scope)).toContain("media:audio");
  });
});

describe("isAdminUser", () => {
  it("returns true for super admin", () => {
    expect(isAdminUser(makeUser({ isSuperAdmin: true }))).toBe(true);
  });

  it("returns true for site admin", () => {
    expect(isAdminUser(makeUser({ siteAssignment: makeAssignment(true) }))).toBe(true);
  });

  it("returns false for scoped editor", () => {
    expect(isAdminUser(makeUser({ siteAssignment: makeAssignment(false, ["collection:pages"]) }))).toBe(false);
  });

  it("returns false for user with no assignment", () => {
    expect(isAdminUser(makeUser())).toBe(false);
  });
});

describe("hasCollectionAccess", () => {
  it("admin always has access", () => {
    expect(hasCollectionAccess(makeUser({ isSuperAdmin: true }), "pages")).toBe(true);
    expect(hasCollectionAccess(makeUser({ siteAssignment: makeAssignment(true) }), "pages")).toBe(true);
  });

  it("returns true for full collection scope", () => {
    const user = makeUser({ siteAssignment: makeAssignment(false, ["collection:pages"]) });
    expect(hasCollectionAccess(user, "pages")).toBe(true);
  });

  it("returns true when user has any entry scope in the collection", () => {
    const user = makeUser({ siteAssignment: makeAssignment(false, ["entry:pages:about"]) });
    expect(hasCollectionAccess(user, "pages")).toBe(true);
  });

  it("returns false for scope in a different collection", () => {
    const user = makeUser({ siteAssignment: makeAssignment(false, ["collection:sermons"]) });
    expect(hasCollectionAccess(user, "pages")).toBe(false);
  });

  it("returns false for user with no scopes", () => {
    expect(hasCollectionAccess(makeUser(), "pages")).toBe(false);
  });
});

describe("hasMediaAccess", () => {
  it("admin always has access", () => {
    expect(hasMediaAccess(makeUser({ isSuperAdmin: true }))).toBe(true);
  });

  it("returns true when user has any media scope", () => {
    const user = makeUser({ siteAssignment: makeAssignment(false, ["media:images"]) });
    expect(hasMediaAccess(user)).toBe(true);
  });

  it("returns false with no media scopes", () => {
    const user = makeUser({ siteAssignment: makeAssignment(false, ["collection:pages"]) });
    expect(hasMediaAccess(user)).toBe(false);
  });
});

describe("hasSiteConfigAccess", () => {
  it("admin always has access", () => {
    expect(hasSiteConfigAccess(makeUser({ isSuperAdmin: true }))).toBe(true);
  });

  it("returns true when user has any site-config scope", () => {
    const user = makeUser({ siteAssignment: makeAssignment(false, ["site-config:navigation"]) });
    expect(hasSiteConfigAccess(user)).toBe(true);
  });

  it("returns false with no site-config scopes", () => {
    const user = makeUser({ siteAssignment: makeAssignment(false, ["collection:pages"]) });
    expect(hasSiteConfigAccess(user)).toBe(false);
  });
});
