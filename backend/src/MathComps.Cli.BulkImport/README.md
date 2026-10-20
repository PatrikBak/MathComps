# Bulk Import CLI

Imports authored problem drafts into the database and image storage, through `validate` (a dry run that writes nothing) and `apply` (the import).

The draft format lives in [the draft format reference](../../../web/scripts/PREFLIGHT_README.md), which owns the folder layout, `_meta.yaml`, the image rules and the embargo field.

## How It Works

`validate` and `apply` run the same pipeline, so a clean dry run all but guarantees a clean import. It checks, in order:

- **Preflight** — the `web/` TypeScript preflight (`npm run draft:preflight`) reads the folder and reports any format, markdown or image problem.
- **Figures** — every referenced image must size cleanly, the same read `apply` performs on import.
- **Tag slugs** — every slug in a `pN.yaml` must be in the approved vocabulary, which the preflight cannot see.
- **Registry** — every competition on the path must be registered in the shared taxonomy and carry both names in every locale, and the last one must be a leaf.
- **DB preview** — what each problem would create, overwrite, or leave unchanged, compared by content so a no-op re-import isn't flagged. It also carries the checks needing a database: round contiguity, the `pN.yaml` a new problem must have, a second original, a stored taxonomy node the registry can't place, the problem count a hosted round's group announced, and [the pool's own checks](#filling-the-pool).

`apply` upserts what the draft describes: the taxonomy and its sort order, the round, the problems, their texts, authors and tags, and a pool problem's proposal. Figures upload to R2 as each problem is written, and their refs are rewritten to the `media:` keys the site resolves. Only texts that actually changed are rewritten.

A run that would change a defended problem's statement is refused, since a stale draft applied after a rearrangement would file those defenses under a different problem. A solution change goes through, as each defense keeps the solution it was argued against. `--allow-restating` downgrades the refusal to a warning, which is what a typo fix wants. The flag covers every folder the run matched, so a batch takes it all at once.

Image uploads are deduplicated against a gitignored ledger (`data/problems/.r2-uploads.json`) mapping each storage key to a hash of the bytes last pushed under it. The report's `Images` line counts what was uploaded and skipped; delete the ledger to force a fresh upload of everything.

Tag the draft before `validate`, so the [Tagging CLI](../MathComps.Cli.Tagging/README.md)'s slugs get checked on the dry run.

## Command Reference

Run from the repo root. `validate` and `apply` take draft folders as paths and/or globs, the wildcard matching sibling directories only. Match more than one and each folder gets its own report block, with a tally at the end.

### validate

Dry-run a draft: run the checks and report issues. Writes nothing.

```bash
# one folder
dotnet run --project backend/src/MathComps.Cli.BulkImport -- validate ./my-draft
# every sibling folder the glob matches
dotnet run --project backend/src/MathComps.Cli.BulkImport -- validate 'data/problems/skmo-2025-*'
```

- `--allow-restating` — report a rewrite of a defended problem's statement as a warning instead of refusing the folder.

The report lists every problem the import would create, with its languages, every problem it would update, and every text it would add or overwrite on an existing problem. Texts it would leave unchanged collapse into one count. A passing draft's report also predicts the `Problems:` line `apply` prints.

Exits `0` when every folder is clean, `1` when any folder errored, crashed, or nothing matched.

### apply

Import a draft: validate first, then write to the database and upload images.

```bash
# one folder
dotnet run --project backend/src/MathComps.Cli.BulkImport -- apply ./my-draft
# every sibling folder the glob matches
dotnet run --project backend/src/MathComps.Cli.BulkImport -- apply 'data/problems/skmo-2025-*'
```

- `--allow-restating` — as above, and it applies to every folder in the run.

A folder that fails validation writes nothing and the batch moves on. There is no transaction around the import itself, so a folder that crashes part-way can leave rows written and figures uploaded. Exits `0` only when every folder imported.

## Embargoing a round

A `visibleSince` in `_meta.yaml` holds a round back until the instant it names, and the draft owns the field: re-applying without it lifts a stored embargo.

On a round a hosted group runs, the embargo stops being the draft's to move: `apply` refuses unless the draft's `visibleSince` equals the instant already stored on the round. Declaring the group stamps that instant from its `closesAt`, but the check reads the stored value, not the manifest. `validate` does not see this at all, so the refusal lands on the import.

The embargo hides the problems, not their figures. Those go to public storage the moment `apply` runs, keyed by the problem's slug and the figure's filename (`problems/75-csmo-a-iii-1-incircle`), so anyone guessing both can fetch a figure early. Everything else stays withheld until the round opens.

## Filling the pool

A draft for `mathcomps-proposals` fills the pool the problem selection picks from. A pool draft is written in English: `language: en`. It carries `visibleSince: 9999-01-01T00:00:00Z`, the instant every round of the pool is held back by, and `validate` refuses any other (`proposals-embargo`). It names the organization whose pool it fills, `organization: <slug>`, and `validate` refuses a pool draft naming none or one no organization goes by, and any other draft naming one (`proposals-organization`). Every organization's problems share the pool's round, so a new problem takes a place none of them holds. Each `pN.yaml` carries a `proposal:` block, whose format is in [the draft format reference](../../../web/scripts/PREFLIGHT_README.md#a-problem-of-the-pool).

The import finds a pool problem by its place, the `N` of `pN`, so a pool problem keeps the place it first took. `validate` refuses a draft that clashes with what the pool holds:

- a new problem with no block (`missing-proposal`), or a block outside the pool (`proposal-outside-pool`);
- a number another problem's proposal in the same organization's pool holds, even one finalized into a round or deleted (`proposal-number-taken`);
- a place holding another organization's proposal (`proposal-other-pool`), a deleted proposal (`proposal-deleted`), another proposal (`proposal-place-taken`), or a problem no proposal files (`proposal-place-unfiled`);
- a category name the pool's organization doesn't list (`proposal-unknown-category`).

`apply` writes the proposal with its problem. A re-import refreshes its title, area and categories. Setting it aside and deleting it are the reviewers' after that.

## Setup

- **Node + npm** — the preflight runs `web/`'s `draft:preflight` script, so `npm` must be on your PATH with `web/` dependencies installed.
- **Database** — every command needs a reachable one, and `validate` fails rather than warns without it.
- **Cloudflare R2** (`apply` only) — uploads need the `CloudflareR2` settings, see [step 6 of the main backend README](../../README.md#6-configure-cloudflare-r2).

Every backend project shares one user-secrets store (see the [main backend README](../../README.md)).
