# Scripts

Convenience scripts for working with the staging and production databases locally via an SSH tunnel. The remote Postgres only listens on the box's loopback, so every command reaches it through a tunnel.

The tools these run live under [`backend/src/MathComps.Cli.*`](../README.md#cli-tools); the draft importer is the [Bulk Import CLI](../src/MathComps.Cli.BulkImport/README.md).

## Setup

1. Copy `.env.example` to `.env` and fill in your SSH credentials:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your actual values. `SSH_HOST` should be a host alias from `~/.ssh/config` (which supplies the user, hostname and key), so no key path is needed here.

3. Optionally, create `.env.prod` / `.env.staging` only to override a secret that differs between environments (e.g. a different DB password for staging):

   ```bash
   cp .env.prod.example .env.prod
   ```

   The per-environment ports already ship in the committed `.env.prod.example` / `.env.staging.example`, so you don't need these files just to switch environments.

## Usage

### Running tools

`invoke-tool.sh` handles the tunnel for you — one command, no separate tunnel step. It reuses an already-open tunnel if one is listening (see below), otherwise opens its own and closes it on exit:

```bash
# Run a tool against the production database (prod is the default environment)
./invoke-tool.sh sync-users

# Run against staging instead
./invoke-tool.sh -e staging sync-users

# Use a specific launch profile
./invoke-tool.sh embeddings -p "Regenerate"

# Import problem drafts into the database (one or more folders; globs allowed)
./invoke-tool.sh -e staging bulk-import validate ./my-draft              # dry-run, writes nothing
./invoke-tool.sh -e staging bulk-import validate 'data/problems/skmo-*'  # a whole batch
./invoke-tool.sh -e prod bulk-import apply ./my-draft                    # the real import
```

Relative paths (like `./my-draft`) resolve against your current directory, not the tool's project directory.

Run `./invoke-tool.sh` with no arguments for the current list of commands.

### Importing a draft

`apply-draft.sh` wraps the import in the one step that has to go with it. A defense session snapshots its problem's statement and reference solution when it starts and never re-reads them, so a session that predates a rewrite keeps arguing text the site no longer shows. `--clear-defenses` deletes every defense session on the draft's competition, after the import lands:

```bash
# Read-only: validate, and list the defense sessions the import would strand
./apply-draft.sh --validate-only ./data/problems/mc-practice-2026

# Import, and clear the defenses that would now hold the old text
./apply-draft.sh -e prod --clear-defenses ./data/problems/mc-practice-2026
```

The competition comes from the draft's own `_meta.yaml`, so there is no second argument to keep in step. One tunnel serves the whole run: `invoke-tool.sh` finds the one this script opened and reuses it.

`defense_spends` is left alone by `--clear-defenses`. It carries no session foreign key on purpose: it is the ledger the daily spend ceiling reads, and clearing it would make the ceiling evadable.

### Opening a standalone tunnel

When you want a long-lived tunnel — e.g. to poke at the database with `psql` or `mathcomps-ro` — open one directly and leave it running:

```bash
# Production (default)
./open-db-tunnel.sh

# Staging
./open-db-tunnel.sh staging
```

The database is then reachable at `localhost:$DB_TUNNEL_PORT`. Press Ctrl-C to close the tunnel.

## Environment loading order

The scripts load environment variables in this order (later files override earlier):

1. `.env.example` — base defaults
2. `.env.{prod|staging}.example` — env-specific defaults (ports)
3. `.env` — your secrets (SSH host alias, passwords)
4. `.env.{prod|staging}` — env-specific secret overrides (e.g. a different password per environment)

## Scripts

- **`open-db-tunnel.sh`** – Opens an SSH tunnel to the database and holds it open.
- **`invoke-tool.sh`** – Runs a CLI tool against the tunneled database (auto-manages its own tunnel).
- **`apply-draft.sh`** – Runs a bulk-import draft against the tunneled database.
- **`lib-env.sh`**, **`lib-tunnel.sh`** – Sourced by the three above; they load the environment and open the tunnel.
