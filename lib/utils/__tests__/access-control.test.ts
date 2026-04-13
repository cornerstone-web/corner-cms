import { describe, it, expect } from "vitest";
import { hasScope, isValidScope, STATIC_SCOPES } from "@/lib/utils/access-control";
import type { User } from "@/types/user";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    auth0Id: "auth0|u1",
    email: "u@test.com",
    name: "Test",
    isSuperAdmin: false,
    churchAssignment: null,
    ...overrides,
  };
}

function makeAssignment(isAdmin: boolean, scopes: string[] = []) {
  return {
    churchId: "c1",
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

  it("church admin (isAdmin=true) always has any scope", () => {
    const user = makeUser({ churchAssignment: makeAssignment(true) });
    expect(hasScope(user, "collection:sermons")).toBe(true);
  });

  it("user with no assignment has no scope", () => {
    const user = makeUser();
    expect(hasScope(user, "collection:sermons")).toBe(false);
  });

  it("user with explicit scope has that scope", () => {
    const user = makeUser({ churchAssignment: makeAssignment(false, ["collection:sermons"]) });
    expect(hasScope(user, "collection:sermons")).toBe(true);
  });

  it("user without the scope does not have it", () => {
    const user = makeUser({ churchAssignment: makeAssignment(false, ["collection:events"]) });
    expect(hasScope(user, "collection:sermons")).toBe(false);
  });

  it("collection scope grants access to all entries in that collection", () => {
    const user = makeUser({ churchAssignment: makeAssignment(false, ["collection:pages"]) });
    expect(hasScope(user, "entry:pages:youth-ministry")).toBe(true);
    expect(hasScope(user, "entry:pages:about")).toBe(true);
  });

  it("collection scope does NOT grant access to entries in a different collection", () => {
    const user = makeUser({ churchAssignment: makeAssignment(false, ["collection:pages"]) });
    expect(hasScope(user, "entry:sermons:first-sermon")).toBe(false);
  });

  it("explicit entry scope grants access to that entry", () => {
    const user = makeUser({ churchAssignment: makeAssignment(false, ["entry:pages:youth-ministry"]) });
    expect(hasScope(user, "entry:pages:youth-ministry")).toBe(true);
  });

  it("explicit entry scope does NOT grant access to the whole collection", () => {
    const user = makeUser({ churchAssignment: makeAssignment(false, ["entry:pages:youth-ministry"]) });
    expect(hasScope(user, "collection:pages")).toBe(false);
  });
});

describe("isValidScope", () => {
  it("valid collection scopes pass", () => {
    expect(isValidScope("collection:sermons")).toBe(true);
    expect(isValidScope("collection:pages")).toBe(true);
  });

  it("valid site-config scopes pass", () => {
    expect(isValidScope("site-config:navigation")).toBe(true);
    expect(isValidScope("site-config:theme")).toBe(true);
  });

  it("valid media scopes pass", () => {
    expect(isValidScope("media:images")).toBe(true);
    expect(isValidScope("media:video")).toBe(true);
  });

  it("valid entry scopes pass format check", () => {
    expect(isValidScope("entry:pages:youth-ministry")).toBe(true);
  });

  it("invalid prefix fails", () => {
    expect(isValidScope("admin:everything")).toBe(false);
  });

  it("unknown collection name fails", () => {
    expect(isValidScope("collection:unknown-thing")).toBe(false);
  });

  it("unknown site-config section fails", () => {
    expect(isValidScope("site-config:unknown-section")).toBe(false);
  });

  it("unknown media type fails", () => {
    expect(isValidScope("media:unknown-type")).toBe(false);
  });

  it("entry scope with invalid collection fails", () => {
    expect(isValidScope("entry:unknown-collection:slug")).toBe(false);
  });

  it("entry scope missing slug fails", () => {
    expect(isValidScope("entry:pages:")).toBe(false);
    expect(isValidScope("entry:pages")).toBe(false);
  });
});

describe("STATIC_SCOPES", () => {
  it("has all expected collection scopes", () => {
    const collectionScopes = STATIC_SCOPES.filter(s => s.scope.startsWith("collection:"));
    expect(collectionScopes.map(s => s.scope)).toContain("collection:sermons");
    expect(collectionScopes.map(s => s.scope)).toContain("collection:pages");
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
