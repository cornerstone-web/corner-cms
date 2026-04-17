import {
  pgTable,
  pgEnum,
  text,
  integer,
  serial,
  boolean,
  timestamp,
  uuid,
  index,
  uniqueIndex
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const siteStatusEnum = pgEnum("site_status", [
  "provisioning",
  "active",
  "suspended",
]);

export const siteTypeEnum = pgEnum("site_type", [
  "church",
  "organization",
]);

// ─── Multi-tenant tables ──────────────────────────────────────────────────────

export const sitesTable = pgTable("sites", {
  id: uuid("id").defaultRandom().primaryKey(),
  githubRepoName: text("github_repo_name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  cfPagesProjectName: text("cf_pages_project_name"),
  cfPagesUrl: text("cf_pages_url"),
  cfAnalyticsSiteTag: text("cf_analytics_site_tag"),
  customDomain: text("custom_domain"),
  status: siteStatusEnum("status").notNull().default("provisioning"),
  siteType: siteTypeEnum("site_type").notNull().default("church"),
  plan: text("plan").notNull().default("free"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastCmsEditAt: timestamp("last_cms_edit_at"),
  wizardStartedAt: timestamp("wizard_started_at"),
  deletedAt: timestamp("deleted_at"),
}, table => ({
  idx_sites_slug: uniqueIndex("idx_sites_slug").on(table.slug),
  idx_sites_github_repo_name: uniqueIndex("idx_sites_github_repo_name").on(table.githubRepoName),
}));

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  auth0Id: text("auth0_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, table => ({
  idx_users_auth0_id: uniqueIndex("idx_users_auth0_id").on(table.auth0Id),
  idx_users_email: uniqueIndex("idx_users_email").on(table.email),
}));

export const userSiteRolesTable = pgTable("user_site_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  siteId: uuid("site_id").notNull().references(() => sitesTable.id),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, table => ({
  idx_user_site_roles_user_id: index("idx_user_site_roles_user_id").on(table.userId),
  idx_user_site_roles_site_id: index("idx_user_site_roles_site_id").on(table.siteId),
  idx_user_site_roles_user_site: uniqueIndex("idx_user_site_roles_user_site").on(table.userId, table.siteId),
}));

export const userSiteScopesTable = pgTable("user_site_scopes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  siteId: uuid("site_id").notNull().references(() => sitesTable.id),
  scope: text("scope").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  idx_user_site_scopes_unique: uniqueIndex("idx_user_site_scopes_unique").on(table.userId, table.siteId, table.scope),
}));

export const siteWizardStepsTable = pgTable("site_wizard_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id").notNull().references(() => sitesTable.id),
  stepKey: text("step_key").notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("site_wizard_steps_site_step_idx").on(t.siteId, t.stepKey),
  index("site_wizard_steps_site_id_idx").on(t.siteId),
]);

// ─── GitHub App installation token cache ──────────────────────────────────────

export const githubInstallationTokenTable = pgTable("github_installation_token", {
  id: serial("id").primaryKey(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  installationId: integer("installation_id").notNull(),
  expiresAt: timestamp("expires_at").notNull()
}, table => ({
  idx_github_installation_token_installationId: index("idx_github_installation_token_installationId").on(table.installationId)
}));

// ─── CMS config + file cache (unchanged) ─────────────────────────────────────

export const configTable = pgTable("config", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch").notNull(),
  sha: text("sha").notNull(),
  version: text("version").notNull(),
  object: text("object").notNull()
}, table => ({
  idx_config_owner_repo_branch: uniqueIndex("idx_config_owner_repo_branch").on(table.owner, table.repo, table.branch)
}));

export const cacheFileTable = pgTable("cache_file", {
  id: serial("id").primaryKey(),
  context: text("context").notNull().default('collection'),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch").notNull(),
  parentPath: text("parent_path").notNull(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  type: text("type").notNull(),
  content: text("content"),
  sha: text("sha"),
  size: integer("size"),
  downloadUrl: text("download_url"),
  commitSha: text('commit_sha'),
  commitTimestamp: timestamp('commit_timestamp'),
  lastUpdated: timestamp("last_updated").notNull()
}, table => ({
  idx_cache_file_owner_repo_branch_parentPath: index("idx_cache_file_owner_repo_branch_parentPath").on(table.owner, table.repo, table.branch, table.parentPath),
  idx_cache_file_owner_repo_branch_path: uniqueIndex("idx_cache_file_owner_repo_branch_path").on(table.owner, table.repo, table.branch, table.path)
}));
