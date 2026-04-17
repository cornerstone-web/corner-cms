import type { User } from "@/types/user";

// ─── Platform-level scope constants ───────────────────────────────────────────
// Collections are intentionally excluded — they come from each site's .pages.yml.
// Only site-config sections and media types are platform-level constants.

// Documents the platform's supported site-config sections (must stay in sync with STATIC_SCOPES).
const SITE_CONFIG_SECTIONS = [
  "identity", "branding", "contact", "navigation",
  "footer", "service-times", "theme", "integrations", "features",
] as const;

// Documents the platform's supported media types (must stay in sync with STATIC_SCOPES).
const MEDIA_TYPES = [
  "images", "files", "bulletins", "video", "audio",
] as const;

export type StaticScope = {
  scope: string;
  label: string;
  group: "site-config" | "media";
};

export const STATIC_SCOPES: StaticScope[] = [
  // Site Config
  { scope: "site-config:identity",      label: "Edit site name & identity",      group: "site-config" },
  { scope: "site-config:branding",      label: "Edit logo & favicon",            group: "site-config" },
  { scope: "site-config:contact",       label: "Edit contact information",       group: "site-config" },
  { scope: "site-config:navigation",    label: "Edit site navigation",           group: "site-config" },
  { scope: "site-config:footer",        label: "Edit footer",                    group: "site-config" },
  { scope: "site-config:service-times", label: "Edit service times",             group: "site-config" },
  { scope: "site-config:theme",         label: "Edit colors & fonts",            group: "site-config" },
  { scope: "site-config:integrations",  label: "Edit third-party integrations",  group: "site-config" },
  { scope: "site-config:features",      label: "Toggle site features",           group: "site-config" },
  // Media
  { scope: "media:images",    label: "Upload & manage images",    group: "media" },
  { scope: "media:files",     label: "Upload & manage files",     group: "media" },
  { scope: "media:bulletins", label: "Upload & manage bulletins", group: "media" },
  { scope: "media:video",     label: "Upload & manage videos",    group: "media" },
  { scope: "media:audio",     label: "Upload & manage audio",     group: "media" },
];

const STATIC_SCOPE_SET = new Set(STATIC_SCOPES.map(s => s.scope));

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Returns true if the scope string is valid given the site's current collection names.
 *
 * collectionNames should be derived from the site's .pages.yml config at call time
 * (e.g. config.object.content.filter(i => i.type === "collection").map(i => i.name)).
 *
 * - Static scopes (site-config:*, media:*) are validated against a platform allowlist.
 * - collection:{name} requires the collection to exist in collectionNames.
 * - entry:{collection}:{slug} requires the collection to exist and a non-empty slug.
 */
export function isValidScope(scope: string, collectionNames: string[]): boolean {
  if (STATIC_SCOPE_SET.has(scope)) return true;

  if (scope.startsWith("collection:")) {
    const name = scope.replace("collection:", "");
    return name.length > 0 && collectionNames.includes(name);
  }

  if (scope.startsWith("entry:")) {
    const parts = scope.split(":");
    if (parts.length !== 3) return false;
    const [, collection, slug] = parts;
    return collectionNames.includes(collection) && slug.length > 0;
  }

  return false;
}

/**
 * Filters a user's stored scopes down to only those that are currently valid
 * for the site's config. Use this count (not the raw stored count) to determine
 * whether a user has any active access — stored scopes can become stale when a
 * collection is removed from .pages.yml.
 */
export function filterValidScopes(stored: string[], collectionNames: string[]): string[] {
  return stored.filter(s => isValidScope(s, collectionNames));
}

// ─── Access helpers ───────────────────────────────────────────────────────────

/** Returns true if the user is a super admin or a site admin. */
export function isAdminUser(user: User): boolean {
  return user.isSuperAdmin || !!user.siteAssignment?.isAdmin;
}

/**
 * Returns true if the user has any route-level access to a collection —
 * i.e. they hold `collection:{name}` OR at least one `entry:{name}:*` scope.
 * Use this to decide whether to show the collection in the nav or allow the list route.
 */
export function hasCollectionAccess(user: User, collectionName: string): boolean {
  if (isAdminUser(user)) return true;
  const scopes = user.siteAssignment?.scopes ?? [];
  return scopes.some(
    s => s === `collection:${collectionName}` || s.startsWith(`entry:${collectionName}:`)
  );
}

/** Returns true if the user can access any media section. */
export function hasMediaAccess(user: User): boolean {
  if (isAdminUser(user)) return true;
  return (user.siteAssignment?.scopes ?? []).some(s => s.startsWith("media:"));
}

/** Returns true if the user can access any site-config section. */
export function hasSiteConfigAccess(user: User): boolean {
  if (isAdminUser(user)) return true;
  return (user.siteAssignment?.scopes ?? []).some(s => s.startsWith("site-config:"));
}

/**
 * Returns true if the user has access to the given scope.
 *
 * - Super admins and site admins (isAdmin=true) have all scopes.
 * - collection:X grants access to all entry:X:* entries.
 * - All other matches are exact.
 *
 * Note: `user.siteAssignment.scopes` should already be filtered to valid scopes
 * before this is called (see filterValidScopes).
 */
export function hasScope(user: User, scope: string): boolean {
  if (isAdminUser(user)) return true;

  const scopes = user.siteAssignment?.scopes ?? [];
  if (scopes.includes(scope)) return true;

  // collection:pages covers entry:pages:* entries
  if (scope.startsWith("entry:")) {
    const parts = scope.split(":");
    if (parts.length === 3) {
      const collection = parts[1];
      return scopes.includes(`collection:${collection}`);
    }
  }

  return false;
}
