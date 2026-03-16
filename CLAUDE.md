# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pages CMS is an open-source Content Management System for GitHub, designed for static site generators (Jekyll, Next.js, Hugo, Astro, etc.). It provides a user-friendly web interface to edit content directly on GitHub repositories.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM with PostgreSQL, Auth0 for authentication, Octokit for GitHub API.

## Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production (auto-runs db:migrate)
npm run lint             # Run ESLint
npm run db:generate      # Generate Drizzle migrations after schema changes
npm run db:migrate       # Apply pending migrations
npm run db:clear-cache   # Clear file/permission cache from database
```

For development, you need a GitHub App configured. The webhook handler (`/api/webhook/github/`) is not required for local development — the wizard and CMS editor work via direct GitHub API calls.

## Architecture

### Directory Structure

- **`/app`** - Next.js App Router
  - `/(auth)/` - Authentication pages (sign-in flows)
  - `/(main)/` - Main application UI
  - `/api/` - REST API routes
    - `/api/auth/` - OAuth and email auth
    - `/api/webhook/github/` - GitHub webhook handler
    - `/api/[owner]/[repo]/[branch]/` - Content management endpoints (entries, files, collections, media)

- **`/lib`** - Core business logic
  - `auth.ts` - Auth0 session validation and `getAuth()` helper
  - `auth0.ts` / `auth0Management.ts` - Auth0 SDK setup and Management API token helper
  - `githubApp.ts` - GitHub App configuration
  - `githubCache.ts` - GitHub API caching layer
  - `config.ts` - CMS configuration parsing
  - `configSchema.ts` - Zod schema for config validation
  - `crypto.ts` - Token encryption (AES)
  - `cornerstone-version.ts` - GPR version check for `@cornerstone-web/core` update banner
  - `actions/provision.ts` - Super admin: create church record + Auth0 admin user
  - `actions/users.ts` - Church admin: invite / resend invite / update role / remove user
  - `actions/setup.ts` - Wizard: `initWizard`, `launchChurch` (GitHub repo + CF Pages creation)
  - `actions/setup-steps.ts` - Wizard: per-step save actions (hero, identity, staff, content pages, etc.)
  - `actions/cornerstone-update.ts` - Update church repo's `@cornerstone-web/core` dependency
  - `utils/user-helpers.ts` - Shared Auth0 + DB helpers for user provisioning
  - `utils/repoAccess.ts` - `verifyRepoAccess()` guard used in API routes
  - `wizard/` - Content generators: `home-gen.ts`, `nav-gen.ts`, `footer-gen.ts`

- **`/db`** - Database layer (Drizzle ORM)
  - `schema.ts` - Table definitions (users, userChurchRoles, churches, sessions, config, cache)
  - `/migrations/` - SQL migrations

- **`/fields`** - Extensible field type system
  - `/core/` - Built-in types (string, text, date, image, rich-text, code, select, etc.)
  - `/custom/` - User-defined field types
  - `registry.ts` - Dynamic field component loading via webpack require.context

- **`/components`** - React components
  - `/ui/` - shadcn/ui components
  - `/collection/`, `/entry/`, `/file/`, `/media/`, `/repo/` - Feature components
  - `/home/` - Super admin dashboard (`super-admin-dashboard.tsx`) and church portal card (`church-portal-card.tsx`)
  - `/admin/` - Church management UI (`church-management.tsx`, `provision-church-form.tsx`)
  - `/setup/` - Onboarding wizard: `WizardShell.tsx`, `WizardTimeline.tsx`, `WizardProseEditor.tsx`, `steps.ts`, and all step components under `steps/`

### Field Type System

Fields are dynamically registered from `/fields/core` and `/fields/custom`. Each field can export:

- `schema` - Zod validation schema
- `read`/`write` - Format conversion functions
- `EditComponent`/`ViewComponent` - React components
- `defaultValue` - Default value for new entries

To create a custom field, add a folder in `/fields/custom/` with an `index.ts` exporting these.

### Configuration-Driven CMS

Repositories define their CMS structure via `.pages.yml` (or YAML/TOML variants). The schema in `lib/configSchema.ts` validates:

- `media` - Media folder configuration
- `content` - Collections and file definitions with fields
- `components` - Reusable field groups

### Authentication Flow

- Auth0 handles all user authentication (Regular Web App, callback at `/api/auth/callback`)
- Super admins and church users are provisioned via the Auth0 Management API (M2M app)
- Invite flow: super admin provisions a church → Auth0 user created → password-change ticket generated → invite email sent via corner-apostle → user sets password and logs in
- Sessions stored in the DB (`sessions` table); `getAuth()` in `lib/auth.ts` resolves the current user + church assignment
- GitHub tokens (installation tokens) encrypted at rest using AES (`lib/crypto.ts`)

### Caching Strategy

- File contents cached in `cache_file` table with configurable TTL
- Permissions cached in `cache_permission` table
- Cron endpoint (`/api/cron`) clears expired cache entries

## Contributing

- Submit PRs against `main` — this is the Cornerstone production branch
- Use `feature/name` or `fix/description` branch naming

### Multi-Tenant Architecture

The CMS is a closed, invitation-only platform. There is no public sign-up.

**Roles:**
- `super_admin` — platform operator; can provision churches and manage all users (flag on `users` table)
- `church_admin` — manages their church's users and content
- `editor` — edits content only

**Key invariant:** A user can have an active role in at most one church at a time (`assignChurchRole` enforces this). Removing a user from a church soft-deletes both their role row and their user record and hard-deletes their Auth0 account.

**Access guards:**
- `assertCanManageUsers(churchId)` — used in `lib/actions/users.ts`; allows super admin or church admin for that church
- `verifyRepoAccess(repoName)` — used in API route handlers; checks the current user's church assignment matches the repo

### Church Provisioning & Onboarding Wizard

**Provisioning** (`lib/actions/provision.ts`): Super admin fills out a form (display name, slug, admin email/name). This creates the church DB record and Auth0 admin account, and sends an invite email via corner-apostle.

**Onboarding wizard** (`/setup` route, `components/setup/`): The new church admin completes a multi-step wizard that:
1. Collects identity, branding, theme, service times, features, social links, contact info, giving URL, streaming, hero image/video
2. Optionally creates first content (sermon, article, event, ministry, staff, bulletin, FAQ, about/beliefs/visit pages)
3. On "Launch": creates the GitHub repo from `corner-template`, commits all generated content, updates `site.config.yaml`, creates the Cloudflare Pages project, and triggers the first build

Step state is tracked in the `wizard_steps` DB table. Steps are idempotent — completing a step twice is safe.

**Content generators** (`lib/wizard/`):
- `home-gen.ts` — generates `index.md` blocks based on wizard answers
- `nav-gen.ts` — generates the navigation config
- `footer-gen.ts` — generates the footer config

---

## Cornerstone Integration

This is a fork of Pages CMS customized for the Cornerstone church website platform. The following sections document Cornerstone-specific extensions.

### Site Config System

Global site settings live in `template-repo/src/config/site.config.yaml` and are edited via a dedicated CMS editor (`components/site-config/`). The API route at `app/api/.../site-config/route.ts` handles two operations: GET fetches the raw YAML from GitHub and returns it as-is; POST validates the submitted config against `siteConfigSchema` (Zod) and commits the serialized YAML back to GitHub.

**NavElement** (`template-repo/src/config/types.ts`) is a discriminated union — array position determines render order:
- `type: 'link'` — menu item with optional `columns` (dropdown) and `featured` sidebar
- `type: 'search'` — search icon toggle (`enabled: boolean`)
- `type: 'cta'` — call-to-action button (`enabled`, `label`, `href`)

**Footer config** has two separate fields:
- `variant`: `'comprehensive' | 'minimal'` — what elements appear
- `style`: `'centered' | 'left-aligned'` — layout alignment

**CMS editor components** (`components/site-config/`):
- `SiteConfigEditor.tsx` — form + live preview iframe, tabbed sections
- `schema.ts` — Zod schema with `navElementSchema` discriminated union
- `sections/NavigationSection.tsx` — drag-and-drop nav item reordering (dnd-kit)
- `sections/FooterSection.tsx` — drag-and-drop social links, sections, links
- `sections/ServiceTimesSection.tsx` — drag-and-drop service times

**Conditional fields:** `FooterSectionsList` is hidden when `footer.variant === 'minimal'`.

### `templateEditable` — Template vs Page Mode

Fields in `.pages.yml` can be marked `templateEditable: true`. This controls visibility in **template editing mode** (editing the template structure, not page content):

- `templateEditable: true` → field visible in template mode (structural: variants, toggles, counts)
- No `templateEditable` → field hidden in template mode (content: headline, images, description)

Template mode validation in `lib/schema.ts` (`generateZodSchema()`) skips non-`templateEditable` fields, so required content fields don't block template saves.

### `controlledBy` — Field Grouping in Entry Form

Content fields can declare which field controls them via `controlledBy: fieldName`. The entry form (`components/entry/entry-form.tsx` — `ToggleFieldGroup`) renders these as a group: controller first, controlled fields below. When the controller disables them, controlled fields are hidden.

- **Field order matters** — controller must be immediately before its controlled field(s) in `.pages.yml`
- Defined on `Field` type in `types/field.ts`, validated in `lib/configSchema.ts`
- Works for all field types including `component` references
- **Boolean controllers:** field hidden when toggle is OFF (default). Use `controlledByInverse: true` to invert.
- **Select controllers:** add `controlledByValue: "optionValue"` — field shown only when the select equals that value. Example: `controlledBy: variant` + `controlledByValue: button` hides the field unless `variant` is `"button"`.

### Block Picker Modal (`components/entry/block-picker-modal.tsx`)

Opened via "Browse blocks" button in `BlocksField` (`entry-form.tsx`). Self-sources config via `useConfig()` for `blockCategories` and `previewBaseUrl`.

- **Desktop:** `max-w-4xl` dialog; clicking a block name splits to 40/60 list/preview pane
- **Mobile:** full-screen dialog with navigation stack (tap → preview slide, "+" to quick-add)
- **Search:** filters across all categories by name, label, description
- **Preview iframe:** points to `${previewBaseUrl}/preview/${blockType}` with no `?data=` — PreviewWrapper renders with block's built-in placeholder data
- Blocks without a `category` in `.pages.yml` fall into an "Other" group

### PreviewWrapper Standalone Rendering

`template-repo/src/components/preview/PreviewWrapper.tsx` renders blocks with placeholder data when no CMS postMessage data is provided (instead of showing a spinner). This enables the block picker modal previews and standalone `/preview/*` navigation without CMS data setup.

### Custom Fields (`fields/custom/`)

Add a folder with an `index.ts` (or `index.tsx`) exporting any of:
- `schema` — Zod validation schema
- `read` / `write` — format conversion when reading/writing files
- `EditComponent` — React component for field editing
- `ViewComponent` — React component for display in collection lists
- `defaultValue` — default value for new entries

Field names in `fields/custom/` override core fields if they share a name. Current custom fields: `icon`, `inline-rich-text`, `template`.
