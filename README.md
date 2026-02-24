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

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Copy the example env file

```bash
cp .env.local.example .env
```

### 3. Create a GitHub App

Follow the GitHub App setup instructions in the [Pages CMS docs](https://github.com/pages-cms/pages-cms). A few local-specific notes:

- Use `openssl rand -base64 32` to generate random secrets (`CRYPTO_KEY`, `GITHUB_APP_WEBHOOK_SECRET`)
- For the Webhook URL, you need a public tunnel. Start ngrok in a separate terminal:

```bash
ngrok http 3000
```

- Paste the ngrok HTTPS URL as the Webhook URL (e.g. `https://abc123.ngrok-free.app/api/webhook/github`). **You'll need to update this in your GitHub App settings each time you restart ngrok.**
- Set the OAuth Callback URL to `http://localhost:3000/api/auth/github`

### 4. Start a local PostgreSQL database

```bash
docker run --name pages-cms-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15
```

Then add this to your `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
```

### 5. Fill in the remaining `.env` values

See the environment variables table below. At minimum you need the GitHub App credentials and `CRYPTO_KEY`.

### 6. Run migrations and start the dev server

```bash
npm run db:migrate
npm run dev
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✓ | PostgreSQL connection string (use Supabase Transaction pooler URL) |
| `CRYPTO_KEY` | ✓ | AES key for encrypting GitHub tokens — `openssl rand -base64 32` |
| `GITHUB_APP_ID` | ✓ | GitHub App ID |
| `GITHUB_APP_NAME` | ✓ | GitHub App machine name (slug from the App settings URL) |
| `GITHUB_APP_PRIVATE_KEY` | ✓ | PEM private key from the GitHub App |
| `GITHUB_APP_WEBHOOK_SECRET` | ✓ | Webhook secret set on the GitHub App |
| `GITHUB_APP_CLIENT_ID` | ✓ | OAuth client ID from the GitHub App |
| `GITHUB_APP_CLIENT_SECRET` | ✓ | OAuth client secret from the GitHub App |
| `RESEND_API_KEY` | ✓ | [Resend](https://resend.com) API key for magic-link auth emails |
| `RESEND_FROM_EMAIL` | ✓ | Verified sender address (e.g. `CMS <cms@example.com>`) |
| `BASE_URL` | | Override base URL when not deploying to Vercel |
| `FILE_CACHE_TTL` | | File cache TTL in minutes. Default: `1440`. `-1` = never expire, `0` = no cache |
| `PERMISSION_CACHE_TTL` | | Permission cache TTL in minutes. Default: `60`. `0` = always check GitHub |
| `CRON_SECRET` | | Secret for the `/api/cron` cache-clearing endpoint |

## License

[MIT](LICENSE) — same as the upstream Pages CMS project.
