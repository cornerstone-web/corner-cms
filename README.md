# Cornerstone Pages CMS

A content management system purpose-built for the [Cornerstone](https://github.com/cornerstone-web) church website platform. Originally based on [Pages CMS](https://github.com/pages-cms/pages-cms) — refer to that project for general CMS documentation, field types, and the upstream architecture.

## How this differs from Pages CMS

### Platform-baked schema

Standard Pages CMS reads a `.pages.yml` file from each repository to define the CMS structure. Cornerstone church repos don't have a `.pages.yml` — the schema is defined in [`@cornerstone-web/core`](https://github.com/cornerstone-web/cornerstone-core) alongside the block components it describes.

On load, the CMS reads the church repo's `package-lock.json` to find the exact installed version of `@cornerstone-web/core`, then fetches the matching `.pages.yml` from `cornerstone-web/cornerstone-core` at the corresponding git tag (`v{version}`). The result is cached in the database by version; subsequent loads skip the GitHub fetch entirely.

This means the CMS schema and the site code are always version-matched — adding a block to `cornerstone-core` automatically makes it available in the CMS once the church repo updates its dependency.

### Site config editor

A dedicated editor for `src/config/site.config.yaml` — the church-specific settings file (navigation, footer, contact info, theme, service times). Changes are committed directly to GitHub.

### Block picker

A modal block picker with category filtering, search, and live iframe previews powered by the deployed church site's `/preview/*` routes.

### Custom fields

| Field | Purpose |
|---|---|
| `icon` | Lucide icon picker |
| `inline-rich-text` | Single-line rich text (bold, italic, links) without block-level formatting |
| `template` | Selects a named content template and populates fields from it |

### `templateEditable`

Fields can be marked `templateEditable: true` to control visibility in template editing mode. Fields without this flag are hidden and use placeholder data when editing a template — only structural fields (variants, toggles, counts) are exposed.

### `controlledBy`

Fields can declare `controlledBy: toggleFieldName` to group themselves under a boolean toggle in the entry form. Controlled fields render indented beneath their toggle and appear muted when the toggle is off. Required validation is only enforced when the toggle is on.

Nested chains are supported — a controlled field can itself be a select that controls further fields via `controlledByValue`. The entry form handles recursive `ToggleFieldGroup` rendering automatically.

### R2 Media Integration

Video and audio fields are backed by [corner-media](https://github.com/cornerstone-web/corner-media) — a Cloudflare Worker that proxies uploads/deletes/listings to Cloudflare R2. The CMS generates short-lived HMAC tokens server-side; the browser uploads directly to corner-media without ever receiving R2 credentials.

**Unified media page** — `/media` shows all media in 5 category tabs: Images, Videos, Audio, Documents, Other. Videos and Audio tabs display R2-hosted files; the others show GitHub-hosted files.

**Field types**: `video` and `audio` behave like `image` but store absolute `https://` URLs (not repo-relative paths). Zod schemas in `cornerstone-core` pass these through unchanged.

**Required env vars** (in addition to the standard set):

| Variable | Description |
|----------|-------------|
| `CORNER_MEDIA_URL` | corner-media Worker URL |
| `CORNER_MEDIA_SECRET` | Shared HMAC secret — must match the `CORNER_MEDIA_SECRET` Worker secret |
| `R2_PUBLIC_URL` | Public R2 base URL (e.g. `https://media.cornerstoneweb.dev`) |

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Copy the example env file

```bash
cp .env.example .env
```

### 3. Create an Auth0 application

Authentication is handled by Auth0 (not GitHub OAuth). You need two Auth0 applications:

**Regular Web App** (for user login):
- Set the Allowed Callback URL to `http://localhost:3000/api/auth/callback`
- Set the Allowed Logout URL to `http://localhost:3000`
- Copy the Domain, Client ID, and Client Secret into `.env`

**Machine-to-Machine App** (for provisioning church admin accounts via the Management API):
- Authorize it against the Auth0 Management API with the `create:users` and `create:user_tickets` permissions
- Copy its Client ID and Client Secret into `.env` as `AUTH0_MANAGEMENT_CLIENT_ID` / `AUTH0_MANAGEMENT_CLIENT_SECRET`

### 4. Create a GitHub App

The GitHub App is used for repository access only (not for user auth). Create one in your GitHub org:

- For the Webhook URL, use any placeholder (e.g. `http://localhost:3000/api/webhook/github`) — webhooks are not required for local development
- Note the Installation ID from the App settings → Installations page
- Generate and download a private key

### 5. Start a local PostgreSQL database

```bash
docker run --name pages-cms-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15
```

Then add to your `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
```

### 6. Fill in the remaining `.env` values

See the environment variables table below. At minimum you need the Auth0 credentials, GitHub App credentials, and `CRYPTO_KEY`.

### 7. Run migrations and start the dev server

```bash
npm run db:migrate
npm run dev
```

### Environment variables

#### Core (required)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon or local Docker) |
| `AUTH0_DOMAIN` | Auth0 tenant domain (e.g. `your-tenant.us.auth0.com`) |
| `AUTH0_CLIENT_ID` | Client ID from the Regular Web App |
| `AUTH0_CLIENT_SECRET` | Client secret from the Regular Web App |
| `AUTH0_SECRET` | Random 64-char hex for session cookie encryption — `openssl rand -hex 32` |
| `APP_BASE_URL` | Base URL with no trailing slash (e.g. `https://cms.example.com` or `http://localhost:3000`) |
| `AUTH0_MANAGEMENT_CLIENT_ID` | Client ID from the M2M app (Management API) |
| `AUTH0_MANAGEMENT_CLIENT_SECRET` | Client secret from the M2M app |
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | PEM private key from the GitHub App |
| `GITHUB_APP_WEBHOOK_SECRET` | Webhook secret set on the GitHub App |
| `GITHUB_APP_INSTALLATION_ID` | Org-level installation ID (App settings → Installations) |
| `CRYPTO_KEY` | AES-256 key for encrypting GitHub tokens — `openssl rand -hex 32` |

#### Wizard & provisioning

| Variable | Description |
|---|---|
| `GITHUB_ORG` | GitHub org where church repos live (default: `cornerstone-web`) |
| `GITHUB_TEMPLATE_REPO` | Template repo to fork when provisioning (default: `template-repo`) |
| `CF_PAGES_GITHUB_TOKEN` | Classic PAT with `read:packages` — injected into new church CF Pages deployments |
| `CF_ACCOUNT_ID` | Cloudflare account ID for auto-creating CF Pages projects |
| `CF_API_TOKEN` | CF API token with Pages edit permission |
| `CORNER_APOSTLE_URL` | corner-apostle Worker URL (for church form registration at launch) |
| `CORNER_APOSTLE_REPO` | GitHub repo name for corner-apostle (default: `corner-apostle`) |
| `CORNERSTONE_INTERNAL_SECRET` | Shared secret for server-to-server calls to corner-apostle (`/send-invite`) |
| `CORNERSTONE_API_KEY` | Public API key for church form submissions |

#### R2 media

| Variable | Description |
|---|---|
| `CORNER_MEDIA_URL` | corner-media Worker URL |
| `CORNER_MEDIA_SECRET` | Shared HMAC secret — must match `CORNER_MEDIA_SECRET` in corner-media |
| `R2_PUBLIC_URL` | Public R2 base URL (e.g. `https://media.cornerstoneweb.dev`) |

#### Optional / tuning

| Variable | Description |
|---|---|
| `CRON_SECRET` | Bearer token for the `/api/cron` cache-clearing endpoint |
| `FILE_CACHE_TTL` | File cache TTL in minutes. Default: `1440`. `-1` = never expire, `0` = no cache |

## License

[MIT](LICENSE) — same as the upstream Pages CMS project.
