import type { User } from "@/types/user";

// ─── Scope constants ──────────────────────────────────────────────────────────

const COLLECTION_NAMES = [
  "pages", "sermons", "series", "events",
  "articles", "ministries", "staff", "templates",
] as const;

const SITE_CONFIG_SECTIONS = [
  "identity", "branding", "contact", "navigation",
  "footer", "service-times", "theme", "integrations", "features",
] as const;

const MEDIA_TYPES = [
  "images", "files", "bulletins", "video", "audio",
] as const;

export type StaticScope = {
  scope: string;
  label: string;
  group: "collection" | "site-config" | "media";
};

export const STATIC_SCOPES: StaticScope[] = [
  // Collections
  { scope: "collection:pages",       label: "Manage all pages",            group: "collection" },
  { scope: "collection:sermons",     label: "Manage all sermons",          group: "collection" },
  { scope: "collection:series",      label: "Manage all sermon series",    group: "collection" },
  { scope: "collection:events",      label: "Manage all events",           group: "collection" },
  { scope: "collection:articles",    label: "Manage all articles",         group: "collection" },
  { scope: "collection:ministries",  label: "Manage all ministries",       group: "collection" },
  { scope: "collection:staff",       label: "Manage all staff",            group: "collection" },
  { scope: "collection:templates",   label: "Manage block templates",      group: "collection" },
  // Site Config
  { scope: "site-config:identity",      label: "Edit church name & identity",    group: "site-config" },
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
 * Returns true if the scope string is valid.
 * - Static scopes (collection:*, site-config:*, media:*) must match the allowlist.
 * - Entry scopes (entry:{collection}:{slug}) require a known collection and non-empty slug.
 */
export function isValidScope(scope: string): boolean {
  if (STATIC_SCOPE_SET.has(scope)) return true;

  if (scope.startsWith("entry:")) {
    const parts = scope.split(":");
    // entry:collection:slug — must have exactly 3 parts, valid collection, non-empty slug
    if (parts.length !== 3) return false;
    const [, collection, slug] = parts;
    return (COLLECTION_NAMES as readonly string[]).includes(collection) && slug.length > 0;
  }

  return false;
}

// ─── Access check ─────────────────────────────────────────────────────────────

/**
 * Returns true if the user has access to the given scope.
 *
 * - Super admins and church admins (isAdmin=true) have all scopes.
 * - collection:X grants access to all entry:X:* entries.
 * - All other matches are exact.
 */
export function hasScope(user: User, scope: string): boolean {
  if (user.isSuperAdmin) return true;
  if (user.churchAssignment?.isAdmin) return true;

  const scopes = user.churchAssignment?.scopes ?? [];
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
