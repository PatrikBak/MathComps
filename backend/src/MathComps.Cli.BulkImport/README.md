# Bulk Import CLI

Imports authored problem drafts into the database and image storage. A single-command tool: pass it draft folders, and `--dry-run` to see what the import would do without keeping anything.

The draft format lives in [the draft format reference](../../../web/scripts/PREFLIGHT_README.md), which owns the folder layout, `_meta.yaml`, the image rules and the embargo field.

## How It Works

Each folder is checked on its own terms first:

- **Preflight** — the `web/` TypeScript preflight (`npm run draft:preflight`) reads the folder and reports any format, markdown or image problem.
- **Figures** — every referenced image must size cleanly, the same read the import performs.
- **Tag slugs** — every slug in a `pN.yaml` must be in the approved vocabulary, which the preflight cannot see.
- **Registry** — every competition on the path must be registered in the shared taxonomy and carry both names in every locale, and the last one must be a leaf.

A folder with an error here never reaches the database. A clean one is imported in one transaction: the taxonomy and its sort order, the round, the problems, their texts, authors and tags, and a pool problem's proposal. Only texts whose content changed are rewritten.

On the way the import collects every reason the database refuses the draft: a gap in the round's numbering, a new problem without its `pN.yaml` or without an original text, a second original, a hosted round's announced problem count or embargo, and [the pool's own checks](#filling-the-pool). The report lists every refusal at once. A stored taxonomy node the registry can't place is the one refusal that stops the import before the rest are checked.

A dry run is the same import, rolled back before it commits and before any figure uploads, so a clean dry run of a folder is a clean import of it into the database as it stands. A real run uploads the figures to R2 once the import is known to land, then commits. The import rewrites each figure ref to the `media:` key the site resolves, stamped with the figure's size and a hash of its bytes. So a redrawn figure gets a new URL, and its re-import rewrites every text showing it.

Image uploads are deduplicated against a gitignored ledger (`data/problems/.r2-uploads.json`) mapping each storage key to a hash of the bytes last pushed under it. The report's `Images` line counts what was uploaded and skipped; delete the ledger to force a fresh upload of everything.

Tag the draft before the dry run, so the [Tagging CLI](../MathComps.Cli.Tagging/README.md)'s slugs get checked.

## Usage

Run from the repo root. Draft folders go as paths and/or globs, the wildcard matching sibling directories only. Match more than one and each folder gets its own report block, with a tally at the end.

```bash
# dry-run one folder: every check, nothing kept
dotnet run --project backend/src/MathComps.Cli.BulkImport -- ./my-draft --dry-run
# import every sibling folder the glob matches
dotnet run --project backend/src/MathComps.Cli.BulkImport -- 'data/problems/skmo-2025-*'
```

The report lists every problem the import creates, with its languages, every problem it updates, and every text it adds or overwrites on an existing problem. Texts it leaves unchanged collapse into one count. A passing folder also prints the `Problems:` line, and a real run the `Images:` line, above its verdict.

Each folder is its own transaction, so a refused or crashed folder writes nothing to the database and the batch moves on. A path or glob that matches no folder stops the run before any folder is touched. Exits `0` only when every folder passed (or imported), `1` otherwise.

## Embargoing a round

A `visibleSince` in `_meta.yaml` holds a round back until the instant it names, and the draft owns the field: re-importing without it lifts a stored embargo.

On a round a hosted group runs, the embargo stops being the draft's to move: the import refuses unless the draft's `visibleSince` equals the instant already stored on the round (`hosted-embargo`), and the refusal names that instant. Declaring the group stamps it from its `closesAt`, but the check reads the stored value, not the manifest.

The embargo hides the problems, not their figures. Those go to public storage the moment a real import runs, keyed by the problem's slug and the figure's filename (`problems/75-csmo-a-iii-1-incircle`), so anyone guessing both can fetch a figure early. Everything else stays withheld until the round opens.

## Filling the pool

A draft for `mathcomps-proposals` fills the pool the problem selection picks from. A pool draft is written in English: `language: en`. It carries `visibleSince: 9999-01-01T00:00:00Z`, the instant every round of the pool is held back by, and the import refuses any other (`proposals-embargo`). It names the organization whose pool it fills, `organization: <slug>`, and the import refuses a pool draft naming none or one no organization goes by, and any other draft naming one (`proposals-organization`). Every organization's problems share the pool's round, so a new problem takes a place none of them holds. Each `pN.yaml` carries a `proposal:` block, whose format is in [the draft format reference](../../../web/scripts/PREFLIGHT_README.md#a-problem-of-the-pool).

The import finds a pool problem by its place, the `N` of `pN`, so a pool problem keeps the place it first took. The import refuses a draft that clashes with what the pool holds:

- a new problem with no block (`missing-proposal`), or a block outside the pool (`proposal-outside-pool`);
- a number another problem's proposal in the same organization's pool holds, even one finalized into a round or deleted (`proposal-number-taken`);
- a place holding another organization's proposal (`proposal-other-pool`), a deleted proposal (`proposal-deleted`), another proposal (`proposal-place-taken`), or a problem no proposal files (`proposal-place-unfiled`);
- a category name the pool's organization doesn't list (`proposal-unknown-category`).

The import writes the proposal with its problem. A re-import refreshes its title, area and categories. Setting it aside and deleting it are the reviewers' after that.

## Setup

- **Node + npm** — the preflight runs `web/`'s `draft:preflight` script, so `npm` must be on your PATH with `web/` dependencies installed.
- **Database** — a dry run needs a reachable one as much as a real run does.
- **Cloudflare R2** (real runs only) — uploads need the `CloudflareR2` settings, see [step 6 of the main backend README](../../README.md#6-configure-cloudflare-r2).

Every backend project shares one user-secrets store (see the [main backend README](../../README.md)).
