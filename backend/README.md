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

## Development

### Code Formatting

Format code using `dotnet format`:

```bash
# From the backend directory
cd backend
dotnet format
```

## CLI Tools

Command-line tools for data processing, parsing, and AI features. Each tool has its own README with detailed instructions.

### Data Pipeline Tools

- **[Bulk Import](src/MathComps.Cli.BulkImport/README.md)** – Validates and applies problem-draft folders to the database
- **[Competitions](src/MathComps.Cli.Competitions/README.md)** – Declares a hosted group from its manifest: raises the rounds it runs and sets the terms

### AI-Powered Tools

- **[Tagging Assistant](src/MathComps.Cli.Tagging/README.md)** – AI-powered problem categorization via the configured LLM provider
- **[Embeddings CLI](src/MathComps.Cli.Embeddings/README.md)** – Gemini-based vector embedding generator
- **[Similarity System](src/MathComps.Cli.Similarity/README.md)** – Problem similarity calculation using embeddings + tags and other things
- **[Examiner CLI](src/MathComps.Cli.Examiner/README.md)** – AI oral-exam examiner that probes a student's defense of a solution, via the configured LLM provider

### Content Tools

- **[Handouts Parser](src/MathComps.Cli.Handouts/README.md)** – Converts `.tex` handouts to `.json` for frontend

## Deployment

The backend supports separate **staging** and **production** environments using Docker Compose override files.

### Everyday commands

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

### Automatic deploys

Every merge to `main` deploys once the gates are green. The `deploy` job in [ci.yml](../.github/workflows/ci.yml) SSHes to the server and runs [ci-deploy.sh](ci-deploy.sh), which fast-forwards to the commit CI passed, runs `./deploy-prod.sh up -d --build`, and waits for the API's healthcheck. The commands above still work by hand.

Every merge deploys, whatever it touched. One that changed nothing under `backend/` rebuilds from cache and compose keeps the running container, so it costs a minute of CI and no downtime.

The health wait proves the container came up and can reach the database, since `/health` runs a `DbContext` check. That is its whole scope: an LLM backend that is down still passes.

A red `deploy` job is an alert, not a gate. `up -d` swaps the container and applies migrations before the health wait starts, so prod is already serving the new build and failing its healthcheck. Fix forward, or roll back as below.

### Rolling back

To roll back, run `git checkout main && git reset --hard <sha>` on the server, then rebuild. Plain `git checkout <sha>` leaves a detached HEAD, which the next automatic deploy cannot fast-forward, so every later merge fails at that line until someone moves the checkout back onto `main`.

### Setting up a new server

In order. The numbered steps are what any deploy needs, by hand or otherwise; the subsection after them is
what makes deploys automatic.

1. Copy the base example file to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your shared values.

3. Create environment-specific overrides:

   ```bash
   cp .env.prod.example .env.prod        # For production
   cp .env.staging.example .env.staging  # For staging
   ```

4. Edit the override files with environment-specific values (`DOMAIN`). Set it in **both**: each file is
   loaded only for its own environment, and a deploy whose file lacks it stops with `DOMAIN: set it in
   .env.<env>`.

5. Create the external volumes once per server. Compose declares them `external: true` and will not create
   them, so a fresh box fails the deploy with `external volume ... not found`:

   ```bash
   docker volume create postgres_data_prod
   docker volume create postgres_data_staging   # only if you run staging
   docker volume create traefik_letsencrypt
   ```

6. Create the per-environment config overrides, empty if you have nothing to override, **before** the first
   `up -d`. Docker turns a missing bind-mount source into an empty directory, which the API then can't read.
   See [Config overrides](#config-overrides) for what goes in them.

   ```bash
   echo '{}' > src/MathComps.Api/appsettings.Production.json
   echo '{}' > src/MathComps.Infrastructure/appsettings.examiner.Production.json
   echo '{}' > src/MathComps.Infrastructure/appsettings.llm.Production.json
   ```

7. Deploy by hand once, to check the stack comes up before CI ever touches it:

   ```bash
   ./deploy.sh prod up -d
   ./deploy.sh prod logs -f api
   ```

#### Wiring up automatic deploys

**1. Make the key. On your laptop:**

```bash
ssh-keygen -t ed25519 -f ~/gha-deploy -N "" -C gha-deploy
cat ~/gha-deploy.pub          # copy this line
```

**2. Prepare the server.** SSH in as the deploy user and go to the checkout, wherever it lives:

```bash
cd <your checkout>

# Agent forwarding is blocked in step 3, so an SSH remote stops working. Switch it.
git remote set-url origin https://github.com/PatrikBak/MathComps.git
git checkout main && git pull
```

**3. Install the key. Still on the server, still in that directory.** Paste the public line from step 1 in
place of `ssh-ed25519 AAAA... gha-deploy`:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "restrict,command=\"$(git rev-parse --show-toplevel)/backend/ci-deploy.sh\" ssh-ed25519 AAAA... gha-deploy" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

**4. Back on your laptop, park the server's address in a shell variable**, the same `user@host` you
already SSH to. Steps 5 and 6 use it, and it is what goes in the `PROD_SSH_TARGET` secret in step 7. Type
it once and reuse it, because ssh files a host key under the name you typed: keyscan the IP, hand GitHub
the hostname, and the key it gets back is a different one.

```bash
SERVER=<user>@<host>
```

**5. Check the key works:**

```bash
ssh -i ~/gha-deploy "$SERVER" whoami
```

This runs a real deploy instead of printing a username. That is the forced command doing its job.

**6. Grab the host key:**

```bash
ssh-keyscan -t ed25519 "${SERVER#*@}"
```

Check the fingerprint against the box before you trust it, then keep the output for the next step.

**7. Add the secrets.** In Settings → Environments, create an environment named `production` and set its
deployment branches to `main` only. Add three secrets **to that environment, not to the repo** (this repo is
public):

| Secret | Value |
|---|---|
| `PROD_SSH_KEY` | the whole of `~/gha-deploy`, the file without `.pub` |
| `PROD_SSH_KNOWN_HOSTS` | step 6's output |
| `PROD_SSH_TARGET` | `$SERVER` from step 4, verbatim |

Merge anything to `main` and watch the `Deploy backend` job.

### Reference

#### Database migrations

Migrations are applied automatically on every deploy: a migration bundle (`efbundle`) built into the image (see the [Dockerfile](Dockerfile)) is run by a one-shot `migrate` service against the local Postgres before the API starts.

- The API is gated on the migrate service finishing successfully, so it won't start if a migration fails — the failing migration is named in `./deploy.sh prod logs migrate`, which an automatic deploy dumps into the job log on its way out.
- It's idempotent: a deploy with nothing pending is a no-op.
- Since deploys are automatic, a merged migration reaches the production database with nobody watching. The
  gate on it is the PR, not the deploy.

#### Config overrides

Per-environment `appsettings.{Production|Staging}.json` files, gitignored and bind-mounted over the
baked-in config, so you can change a value without rebuilding the image. Each sits next to the base file it
overrides and only needs the keys it changes.

`.dockerignore` keeps them out of the build context, so the mount is the only copy. Prod secrets never reach
an image layer, and a mount that goes missing leaves the API on the base `appsettings.json`:

- `src/MathComps.Api/appsettings.{Env}.json` → `appsettings.json` (`Cors`, `DefenseLimits`, `Examiner:UseFake`, …).
  `DefenseLimits` holds what bounds the defense feature: a daily spend ceiling in dollars and a turn cap, both
  reckoned **per user**. There is no aggregate ceiling, so they bound one account, not the day's total. The turn cap
  and the two length caps ride to the browser on every session read, so once the API has restarted on the new value,
  the UI follows on the next page load with no frontend deploy.
- `src/MathComps.Infrastructure/appsettings.examiner.{Env}.json` → `appsettings.examiner.json` (per-step models).
  Config binds arrays by index and merges rather than replaces, so restate a `FallbackModels` chain in full when
  overriding one.
- `src/MathComps.Infrastructure/appsettings.llm.{Env}.json` → `appsettings.llm.json` (LLM endpoint, retries)

- **Apply a change:** edit the file, `./deploy.sh <env> restart api` — no `up -d`, no `--build`. `restart` takes the deploy lock, so it waits if an automatic deploy is in flight.
- **First rollout:** create the files (`echo '{}' > …`) **before** the `up -d` that adds the mounts, else
  Docker turns each missing source into an empty directory. They're gitignored, so `git pull` won't bring them.
- **Locally:** `ASPNETCORE_ENVIRONMENT=Production dotnet run` picks them up too.

#### What `deploy.sh` does around compose

`up`, `down` and `restart` take `/tmp/mathcomps-deploy-<env>.lock`, so a hand deploy and an automatic one can't interleave. Whoever gets there second blocks until the first finishes: your terminal sits there while CI deploys, and CI's job sits there while you do. It gives up after 25 minutes. `logs`, `ps` and `exec` don't take the lock.

After an `up`, success or failure, the script reclaims what the `--build` left behind: images older than 24 hours, and the build cache above 10 GB. It then exits with compose's status, not the prune's.

The `==>` status lines go to stderr, so `$(./deploy-prod.sh ps -q api)` returns just the container id.
