# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pages CMS is an open-source Content Management System for GitHub, designed for static site generators (Jekyll, Next.js, Hugo, Astro, etc.). It provides a user-friendly web interface to edit content directly on GitHub repositories.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM with PostgreSQL, Lucia for authentication, Octokit for GitHub API.

## Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production (auto-runs db:migrate)
npm run lint             # Run ESLint
npm run db:generate      # Generate Drizzle migrations after schema changes
npm run db:migrate       # Apply pending migrations
npm run db:clear-cache   # Clear file/permission cache from database
```

For development, you need a GitHub App configured and a tunnel (e.g., ngrok) for webhooks.

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
  - `auth.ts` - Lucia authentication setup
  - `githubApp.ts` - GitHub App configuration
  - `githubCache.ts` - GitHub API caching layer
  - `config.ts` - CMS configuration parsing
  - `configSchema.ts` - Zod schema for config validation
  - `crypto.ts` - Token encryption (AES)

- **`/db`** - Database layer (Drizzle ORM)
  - `schema.ts` - Table definitions (users, sessions, tokens, collaborators, config, cache)
  - `/migrations/` - SQL migrations

- **`/fields`** - Extensible field type system
  - `/core/` - Built-in types (string, text, date, image, rich-text, code, select, etc.)
  - `/custom/` - User-defined field types
  - `registry.ts` - Dynamic field component loading via webpack require.context

- **`/components`** - React components
  - `/ui/` - shadcn/ui components
  - `/collection/`, `/entry/`, `/file/`, `/media/`, `/repo/` - Feature components

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

- GitHub OAuth via Arctic library
- Email magic links via Resend
- Sessions managed by Lucia with Drizzle adapter
- GitHub tokens encrypted at rest using AES

### Caching Strategy

- File contents cached in `cache_file` table with configurable TTL
- Permissions cached in `cache_permission` table
- Cron endpoint (`/api/cron`) clears expired cache entries

## Contributing

- Submit PRs against `development` branch, not `main`
- `main` is production (app.pagescms.org)
- `development` is staging (dev.pagescms.org)
- Use `feature/name` or `issue/123-description` branch naming

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

Content fields can declare which toggle controls them via `controlledBy: toggleFieldName`. The entry form (`components/entry/entry-form.tsx` — `ToggleFieldGroup`) renders these as a group: toggle first, controlled fields indented below. When the toggle is OFF, controlled fields appear muted.

- **Field order matters** — toggle must be immediately before its controlled field(s) in `.pages.yml`
- Defined on `Field` type in `types/field.ts`, validated in `lib/configSchema.ts`
- Works for all field types including `component` references

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
