# Bulk Import CLI

Imports authored problem drafts into the database and image storage, through `validate` (a dry run that writes nothing) and `apply` (the import). `swap` exchanges the positions of two problems already in the database.

The draft format lives in [the draft format reference](../../../web/scripts/PREFLIGHT_README.md), which owns the folder layout, `_meta.yaml`, the image rules and the embargo field.

## How It Works

`validate` and `apply` run the same pipeline, so a clean dry run all but guarantees a clean import. It checks, in order:

- **Preflight** — the `web/` TypeScript preflight (`npm run draft:preflight`) reads the folder and reports any format, markdown or image problem.
- **Figures** — every referenced image must size cleanly, the same read `apply` performs on import.
- **Tag slugs** — every slug in a `pN.yaml` must be in the approved vocabulary, which the preflight cannot see.
- **Registry** — every competition on the path must be registered in the shared taxonomy and carry both names in all three locales, and the last one must be a leaf.
- **DB preview** — what each problem would create, overwrite, or leave unchanged, compared by content so a no-op re-import isn't flagged. It also carries the checks needing a database: round contiguity, the `pN.yaml` a new problem must have, a second original, a stored taxonomy node the registry can't place, and the problem count a hosted round's group announced.

`apply` upserts what the draft describes: the taxonomy and its sort order, the round, the problems, their texts, authors and tags. Figures upload to R2 as each problem is written, and their refs are rewritten to the `media:` keys the site resolves. Only texts that actually changed are rewritten.

A run that would change a defended problem's statement or solution is refused, since those defenses would then read back text nobody argued about. `--allow-restating` downgrades it to a warning, which is what a typo fix wants. The flag covers every folder the run matched, so a batch takes it all at once.

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

- `--allow-restating` — report a rewrite of a defended problem's text as a warning instead of refusing the folder.

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

### swap

Exchange two problems' positions. Takes two slugs rather than folders.

```bash
# report what would move, writing nothing
dotnet run --project backend/src/MathComps.Cli.BulkImport -- swap 75-csmo-a-iii-1 75-csmo-a-iii-3 --dry-run
dotnet run --project backend/src/MathComps.Cli.BulkImport -- swap 75-csmo-a-iii-1 75-csmo-a-iii-3
```

- `--dry-run` — run every check and print what would move. Writes nothing.

It moves the rows, so every defense, comment and self-assessment travels with the problem it belongs to, and each takes the slug its new position calls for. Figures keep resolving: the markdown holds their storage key. The two problems may sit in different competitions and seasons, which is what lets you trade one out of a MathComps cycle against a problem parked on `mathcomps-proposals`, the node holding problems no competition runs.

This is how to rearrange a defended round. `apply` would rewrite text under the positions it finds, leaving every conversation on the problem that used to be there.

It refuses a slug that names no problem, a slug two problems carry, the same slug twice, and a destination slug a third problem holds. It checks nothing else: a problem keeps neither its embargo nor its hosted group, it inherits the destination round's. Exits `0` when the exchange went through, or a dry run came back clean.

## Embargoing a round

A `visibleSince` in `_meta.yaml` holds a round back until the instant it names, and the draft owns the field: re-applying without it lifts a stored embargo.

On a round a hosted group runs, the embargo stops being the draft's to move: `apply` refuses unless the draft's `visibleSince` equals the instant already stored on the round. Declaring the group stamps that instant from its `closesAt`, but the check reads the stored value, not the manifest. `validate` does not see this at all, so the refusal lands on the import.

The embargo hides the problems, not their figures. Those go to public storage the moment `apply` runs, keyed by the problem's slug and the figure's filename (`problems/75-csmo-a-iii-1-incircle`), so anyone guessing both can fetch a figure early. Everything else stays withheld until the round opens.

## Setup

- **Node + npm** — the preflight runs `web/`'s `draft:preflight` script, so `npm` must be on your PATH with `web/` dependencies installed.
- **Database** — every command needs a reachable one, and `validate` fails rather than warns without it.
- **Cloudflare R2** (`apply` only) — uploads need the `CloudflareR2` settings, see [step 6 of the main backend README](../../README.md#6-configure-cloudflare-r2).

Every backend project shares one user-secrets store (see the [main backend README](../../README.md)).
