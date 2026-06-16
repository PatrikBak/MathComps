# Bulk Import CLI

Imports authored problem drafts into the database and image storage. Two modes: `validate` (dry-run, writes nothing) and `apply` (the real import).

## How It Works

Both commands run the same checks, so a clean `validate` all but guarantees a clean `apply`:

1. **Preflight** — shells out to the `web/` TypeScript preflight (`npm run draft:preflight`), which reads the draft folder and reports any format, markdown or image-reference problems.
2. **Registry check** — every competition / category / round slug in `_meta.yaml` must be registered in the shared taxonomy and carry a localized name in each locale.
3. **DB preview** — a read-only look at what each problem would create, overwrite, or leave unchanged (it compares the would-be body against what's stored, so a no-op re-import isn't flagged as an overwrite). Being DB-aware, this is also where the safety checks the format preflight can't make live: the import must leave the round's problem orders contiguous (`1..N`, no gap — so a `p4` whose problem doesn't exist yet is rejected), a newly-created problem must carry a `pN.yaml` sidecar, and an original may not collide with a stored original in another language.

`apply` runs all three, aborts on any error, then uploads images to R2, rewrites their refs (relative `images/…` → a `media:` id the site resolves to the uploaded copy), and upserts the taxonomy, problems, texts and authors. A re-import overwrites only the texts that actually changed and leaves identical ones untouched (idempotent).

Image uploads are deduplicated against a ledger kept beside this tool's sources (`.r2-uploads.json`, gitignored), keyed by storage key → source mtime, so re-applying a draft skips images whose bytes are already on R2 and only re-uploads ones you've changed. Delete the ledger to force a fresh upload of everything. The apply report's `Images` line shows the uploaded and skipped counts.

Tag the draft before importing it: the [Tagging CLI](../MathComps.Cli.Tagging/README.md)'s `tag-draft` writes a `tags:` list into each `pN.yaml`, which `apply` turns into the problem's tags. Run it *before* `validate`, so the preflight checks the slugs.

## Draft folder

A folder of plain files — one round's problems plus their images. Full authoring spec: [the draft format reference](../../../../web/scripts/PREFLIGHT_README.md).

```
my-draft/
  _meta.yaml        # competition / category / round / season / date / language
  p1.sk.md          # problem 1 — statement + solution (one file per language)
  p1.yaml           # problem 1 metadata — authors, solution link, tags
  p2.sk.md
  p2.yaml
  images/           # referenced images (flat)
    incircle.svg
```

## Command Reference

Run these from the repo root — the `--project` and folder paths are relative to your shell. (The `web/` preflight itself is located automatically, so the tool doesn't care which directory you launch it from.)

Both commands take one or more draft folders, given as literal paths and/or globs (the glob's leaf selects sibling directories). One invocation can sweep a whole batch — each matched folder runs through the pipeline independently, in its own report block, with a closing tally.

### validate

Dry-run a draft: run the checks and report issues. Writes nothing.

```bash
dotnet run --project backend/src/MathComps.Cli.BulkImport -- validate ./my-draft
dotnet run --project backend/src/MathComps.Cli.BulkImport -- validate ./my-draft --json
dotnet run --project backend/src/MathComps.Cli.BulkImport -- validate 'data/problems/skmo-2025-*'
```

Exits `0` when every folder is clean, `1` when any folder has an error-severity issue.

### apply

Import a draft: validate first, then write to the database and upload images.

```bash
dotnet run --project backend/src/MathComps.Cli.BulkImport -- apply ./my-draft
dotnet run --project backend/src/MathComps.Cli.BulkImport -- apply 'data/problems/skmo-2025-*'
```

Each folder is validated then applied in turn; a folder that fails validation writes nothing and the batch moves on to the rest. Exits `0` only when every folder imported, `1` if any failed.

**Options** (both commands):

- `--json` – Emit the structured result as JSON instead of the human-readable report. With multiple folders it's a JSON array, one entry per folder.

## Setup

- **Node + npm** — the preflight runs the `web/` project's `draft:preflight` script, so `npm` must be on your PATH with `web/` dependencies installed.
- **Database** — set the connection string in user secrets (see the [main backend README](../../../README.md)). Both commands need a reachable DB: the safety checks (contiguity, problem existence, second-original) are DB-aware, so `validate` fails — not just warns — when it can't reach one, and `apply` requires it.
- **Cloudflare R2** (`apply` only) — image uploads need the `CloudflareR2` settings:

  ```bash
  cd backend/src/MathComps.Cli.BulkImport
  dotnet user-secrets set "CloudflareR2:AccountId" "..."
  dotnet user-secrets set "CloudflareR2:BucketName" "..."
  dotnet user-secrets set "CloudflareR2:AccessKeyId" "..."
  dotnet user-secrets set "CloudflareR2:SecretAccessKey" "..."
  ```
