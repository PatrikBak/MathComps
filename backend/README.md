# MathComps Backend

The .NET backend for the MathComps application. Includes a Web API and CLI tools for data processing, parsing, and AI-powered features.

## Structure

All projects live flat under `src/`, grouped by their `MathComps.*` names:

- **`src/MathComps.Api`** – Main Web API
  - See the [API README](src/MathComps.Api/README.md) for setup and running instructions
- **`src/MathComps.Domain`**, **`src/MathComps.TexParser`** – Domain models and parsing logic
- **`src/MathComps.Infrastructure`** – Database, EF Core, and data access
  - **`Resources/`** – Shared metadata files (e.g., `approved-tags.json`, `metadata.*.json`)
- **`src/MathComps.Shared`**, **`src/MathComps.Shared.Cli`** – Shared utilities and CLI bootstrap
  - **`MathComps.Shared.Cli`** – `CliApp` host bootstrap, `CliRunner`, and `RepoPaths` (lets the CLI tools run from any directory)
- **`src/MathComps.Cli.*`** – CLI tools for data processing (see below)

### Shared Resources

Metadata files in `src/MathComps.Infrastructure/Resources/` are embedded and copied to output directories, making them available to both the API and CLI tools at runtime via `ResourcePaths` constants.

### Localization

The API supports multiple languages via the `Accept-Language` HTTP header. The frontend sends this header with each request, and the backend uses it to return localized content.

**How it works:**

- **Request Localization Middleware** (`Program.cs`) – Parses `Accept-Language` header and sets `CurrentCulture`
- **Endpoint Extensions** – Helper methods extract the detected language for service calls

**Key localization files in `Resources/`:**

| File                     | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| `metadata.shared.json`   | Language-neutral taxonomy structure & order     |
| `metadata.{locale}.json` | Localized competition names, round labels, etc. |
| `approved-tags.json`     | Tag vocabulary with English slugs (canonical)   |

**Problem translations:**

Problem statements and solutions are stored in the `problem_texts` table with per-language entries. The original language is marked, and translations are authored as per-language draft content and applied via [bulk-import](src/MathComps.Cli.BulkImport/README.md). The API returns problem text in the requested language, falling back to the original if unavailable.

**Adding a new language:**

1. Create `metadata.{locale}.json` with translated competition/round names
2. Add the locale to the `Language` enum (`src/MathComps.Domain/Localization/Language.cs`)
3. Author the problem translations for the new locale and apply them via bulk-import
4. The API will automatically serve content based on `Accept-Language`

## Getting Started

### 1. Database Requirements

This application requires **PostgreSQL with the pgvector extension** for AI-powered similarity search features.

#### Quick Setup with Docker

The database runs in Docker while the API runs natively (`dotnet run`). A dedicated
dev-only compose file ([`docker-compose.dev.yml`](docker-compose.dev.yml)) starts just
Postgres (pg16 + pgvector, matching production) with a persistent named volume:

```bash
# From the backend directory
docker compose -f docker-compose.dev.yml up -d
```

The pgvector extension is created automatically by the migrations in step 3, so no
manual `CREATE EXTENSION` is needed. Data persists in the `pgdata_dev` volume across
restarts — use `docker compose -f docker-compose.dev.yml down` to stop, or add `-v` to
wipe the data.

### 2. Configure Database Connection

Set up your database connection string using .NET user secrets:

```bash
# We need a directory with a .csproj
cd backend/src/MathComps.Api

# Set the value of the connection string
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Database=mathcomps;Username=postgres;Password=postgres"
```

**Remark**: The command above uses the Api project, but the user secrets key is shared for all backend projects (see [`Directory.Build.props`](Directory.Build.props)), so the connection string will be available everywhere.

### 3. Create Database Schema

If creating an empty DB from scratch, apply Entity Framework migrations:

```bash
# From the DB project directory
cd backend/src/MathComps.Infrastructure

# Run the migration tool
dotnet ef database update
```

This will create the database schema including the required PostgreSQL extensions (pgvector).

#### Alternative: Seed from a Production Dump

Instead of building an empty schema with migrations, you can restore a copy of the
production database into the dev container — useful for debugging against real data.

Prod Postgres runs inside a Docker container and only listens on the server's loopback
interface, so you dump it from *inside* the container (where local connections are
trusted — no DB password needed) rather than connecting over the network.

```bash
# 1. On the prod server, from the backend directory, dump the DB to a file.
#    -Fc = compressed custom format (for pg_restore); -T keeps the binary stream clean.
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --env-file .env --env-file .env.prod \
  exec -T postgres pg_dump -U mathcomps -Fc mathcomps > prod.dump

# 2. Copy the dump to your machine (adjust the remote path to where prod.dump landed).
scp your-server:~/prod.dump ~/prod.dump

# 3. Restore it into the local dev container (started via docker-compose.dev.yml).
#    Set DB to the target database — keep `mathcomps` to refresh the DB the app connects
#    to, or use another name to keep several dumps side by side.
DB=mathcomps         # the target database name
DUMP=prod.dump       # the local dump file to restore

# Recreate the target DB from scratch, then restore into it. --force terminates any open
# connections (e.g. a running dev backend) so the drop succeeds; --no-owner/--no-acl drop
# the prod-specific `mathcomps` role so it restores as the dev `postgres` user;
# --single-transaction rolls the restore back on errors.
docker compose -f docker-compose.dev.yml exec -T postgres \
  sh -c "dropdb -U postgres --force --if-exists $DB && createdb -U postgres $DB && \
    pg_restore --no-owner --no-acl --single-transaction -U postgres -d $DB" < "$DUMP"
```

The dump's own `CREATE EXTENSION vector` succeeds because both the prod and dev images
ship the pgvector binary, and the restore is clean because both run Postgres 16
(`pg_restore` does not migrate backwards across major versions — another reason the dev
image is pinned to `pg16`). No migration step is needed after a successful restore. Since
these are single-database dumps (the name lives only in the `-d` flag, not the archive),
the same dump file can be restored under any name you choose.

**Creating new migrations:**

When you modify the data model, create a new migration from the Infrastructure directory:

```bash
# From the Infrastructure directory
cd backend/src/MathComps.Infrastructure
dotnet ef migrations add <MigrationName> --startup-project ../MathComps.Api
```

### 4. Configure AI keys (Optional)

The AI-powered tools authenticate with their own keys, each in the relevant project's user secrets:

```bash
# From the backend directory
cd backend

# Embeddings CLI (and anything else using the Gemini embedding API)
dotnet user-secrets set "Gemini:ApiKey" "your-gemini-api-key" --project src/MathComps.Api

# Tagging CLI — reaches its model through the configured LLM provider
dotnet user-secrets set "Llm:ApiKey" "your-llm-api-key" --project src/MathComps.Cli.Tagging

# Defense feature (AI examiner) in the API — reaches its models through the configured LLM provider.
# Optional: with "Examiner:UseFake": true the API serves defenses cost-free without a key.
dotnet user-secrets set "Llm:ApiKey" "your-llm-api-key" --project src/MathComps.Api
```

Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 5. Configure Clerk Authentication

The API needs three Clerk values for local dev (set once via user secrets — they persist
across runs):

- **Authority** — the Frontend API / issuer URL. Validates incoming JWTs on every
  request; without it the app starts but each request fails with `Clerk authority not found`.
- **Secret key** — used for server-to-Clerk calls (user sync, comment authors, the
  webhook handler).
- **Webhook secret** — `ClerkSettings` validates it whenever its options are loaded,
  which happens on ordinary requests too (not just webhooks) — so it's required to serve
  any request. If you aren't testing real webhooks locally, any non-empty placeholder works.

```bash
# From the API directory
cd backend/src/MathComps.Api

# Use your *development* Clerk instance for local dev
dotnet user-secrets set "Authentication:Clerk:Authority" "https://your-subdomain.clerk.accounts.dev"
dotnet user-secrets set "Clerk:SecretKey" "sk_test_your-clerk-secret-key"
dotnet user-secrets set "Clerk:WebhookSecret" "whsec_placeholder"
```

Find the authority and secret key in the Clerk dashboard under **API Keys** (Frontend
API → authority; Secret keys → secret key) — the same values deployed as
`CLERK_AUTHORITY` and `CLERK_SECRET_KEY`. For the real webhook secret and instructions on
testing webhooks locally, see the [API README](src/MathComps.Api/README.md#webhooks).

### 6. Configure Cloudflare R2

The API reads the AI examiner's problem content from R2, the per-handout blobs the
[Handouts CLI](src/MathComps.Cli.Handouts/README.md) publishes, so a defense against a handout problem
needs these settings. Everything else works without them.

```bash
# From the API directory
cd backend/src/MathComps.Api

dotnet user-secrets set "CloudflareR2:AccountId" "..."
dotnet user-secrets set "CloudflareR2:BucketName" "..."
dotnet user-secrets set "CloudflareR2:AccessKeyId" "..."
dotnet user-secrets set "CloudflareR2:SecretAccessKey" "..."
```

Every project shares one user-secrets store, so setting these once also covers the Handouts and Bulk
Import CLIs; they all talk to the same bucket. Deployments pass the same values as the `R2_*`
variables in `.env` (see [Environment Setup](#environment-setup)).

### 7. Run the API

See the [API README](src/MathComps.Api/README.md) for running instructions.

## CLI Tools

Command-line tools for data processing, parsing, and AI features. Each tool has its own README with detailed instructions.

### Data Pipeline Tools

- **[Bulk Import](src/MathComps.Cli.BulkImport/README.md)** – Validates and applies problem-draft folders to the database

### AI-Powered Tools

- **[Tagging Assistant](src/MathComps.Cli.Tagging/README.md)** – AI-powered problem categorization via the configured LLM provider
- **[Embeddings CLI](src/MathComps.Cli.Embeddings/README.md)** – Gemini-based vector embedding generator
- **[Similarity System](src/MathComps.Cli.Similarity/README.md)** – Problem similarity calculation using embeddings + tags and other things
- **[Examiner CLI](src/MathComps.Cli.Examiner/README.md)** – AI oral-exam examiner that probes a student's defense of a solution, via the configured LLM provider

### Content Tools

- **[Handouts Parser](src/MathComps.Cli.Handouts/README.md)** – Converts `.tex` handouts to `.json` for frontend

## Deployment

The backend supports separate **staging** and **production** environments using Docker Compose override files.

### Quick Start

```bash
# Start production
./deploy.sh prod up -d

# Start staging
./deploy.sh staging up -d

# Stop staging (saves resources)
./deploy.sh staging down

# View logs
./deploy.sh prod logs -f api
```

### Database Migrations

Migrations are applied automatically on every deploy: a migration bundle (`efbundle`) built into the image (see the [Dockerfile](Dockerfile)) is run by a one-shot `migrate` service against the local Postgres before the API starts.

- The API is gated on the migrate service finishing successfully, so it won't start if a migration fails — the failing migration is named in `./deploy.sh prod logs migrate`.
- It's idempotent: a deploy with nothing pending is a no-op.

### Environment Setup

1. Copy the base example file to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your shared values. The `R2_*` block feeds the API's `CloudflareR2` settings; without them every route works except opening a defense.

3. Create environment-specific overrides:

   ```bash
   cp .env.prod.example .env.prod        # For production
   cp .env.staging.example .env.staging  # For staging
   ```

4. Edit the override files with environment-specific values (`DOMAIN`)

### Config Overrides (no container rebuild needed)

Per-environment `appsettings.{Production|Staging}.json` files, gitignored and bind-mounted over the
baked-in config, so you can change a value without rebuilding the image. Each sits next to the base file it
overrides and only needs the keys it changes:

- `src/MathComps.Api/appsettings.{Env}.json` → `appsettings.json` (`Cors`, `DefenseLimits`, `Examiner:UseFake`, …).
  `DefenseLimits` holds what bounds the defense feature: a daily spend ceiling in dollars and a turn cap, both
  reckoned **per user**. There is no aggregate ceiling, so they bound one account, not the day's total. The turn cap
  and the two length caps ride to the browser on every session read, so once the API has restarted on the new value,
  the UI follows on the next page load with no frontend deploy.
- `src/MathComps.Infrastructure/appsettings.examiner.{Env}.json` → `appsettings.examiner.json` (per-step models).
  Config binds arrays by index and merges rather than replaces, so restate a `FallbackModels` chain in full when
  overriding one.
- `src/MathComps.Infrastructure/appsettings.llm.{Env}.json` → `appsettings.llm.json` (LLM endpoint, retries)

- **Apply a change:** edit the file, `./deploy.sh <env> restart api` — no `up -d`, no `--build`.
- **First rollout:** create the files (`echo '{}' > …`) **before** the `up -d` that adds the mounts, else
  Docker turns each missing source into an empty directory. They're gitignored, so `git pull` won't bring them.
- **Locally:** `ASPNETCORE_ENVIRONMENT=Production dotnet run` picks them up too.

## Development

### Code Formatting

Format code using `dotnet format`:

```bash
# From the backend directory
cd backend
dotnet format
```
