# Draft folder format

How competition problems are authored for bulk import. A **draft folder** holds one round's problems as plain files; `npm run draft:preflight <folder>` checks it, and the [bulk-import CLI](../../backend/src/MathComps.Cli.BulkImport/README.md) imports it. The preflight here is the single source of truth for the format — the C# side never re-parses the folder, it consumes this script's JSON manifest.

## Layout

```
my-draft/
  _meta.yaml        # which competition, season and date the problems belong to, when the round opens, and their original language
  p1.sk.md          # problem 1 body, in language "sk"
  p1.en.md          # optional translations of problem 1
  p1.yaml           # problem 1 metadata (one per problem, shared across languages)
  p2.sk.md
  p2.yaml
  images/           # referenced images (optional)
    incircle.svg
```

Problems are numbered from 1. A full fresh import numbers them `p1`, `p2`, … with no gaps, but a draft may also carry an arbitrary **subset** of orders (e.g. just `p4`, to correct one problem). The preflight here doesn't police that — whether the orders fill the round without gaps is decided by the DB-aware `validate` step, which can see what already exists (see [Format vs. validate](#format-vs-validate)).

## `_meta.yaml`

Which competition the problems were set in, and when (display names live in the registry, not here):

```yaml
competition: csmo-a-iii # the competition's path
season:
  year: 2024 # calendar year the season starts
date: 2024-03-15 # round date, YYYY-MM-DD
visibleSince: 2026-09-14T18:00:00Z # optional, when the round opens to readers
language: sk # the draft's original language: sk | cs | en
```

The path is the competition's slugs from the root of the taxonomy down to it, hyphen-joined, and it runs as deep as the taxonomy does: `csmo-a-iii` is round III of category A of the Czech-Slovak MO, `imo` is a competition that runs as one flat sitting, and however deep a competition sits, the path names every level. Every segment is lowercase alphanumeric — a path outside that alphabet is refused here. Each node on the path has to be registered in the taxonomy, which the [bulk-import CLI](../../backend/src/MathComps.Cli.BulkImport/README.md)'s `validate` step checks; the one the path ends at must be a leaf, since a competition carrying others below it is a container rather than a sitting problems belong to.

`visibleSince` embargoes the round. The problems land in the database complete, and the archive begins serving them once that instant passes, with nobody having to flip anything. Omit it and the round is open the moment it is imported.

It must carry an explicit offset (`Z` or `±HH:MM`). A bare wall-clock time would open the round at whatever the importing machine thinks the zone is, and that is the one thing an embargo must not depend on. It is a different axis from `date`, which is the day the round ran and only ever sorts.

It hides the problems, not their images. Figures go to public storage under a key derived from the problem slug as soon as the import runs (see the [bulk-import CLI](../../backend/src/MathComps.Cli.BulkImport/README.md)).

## Problem body — `pN.<lang>.md`

Markdown with inline TeX. **No frontmatter** — metadata lives in `pN.yaml`. The statement comes first; an optional `<!-- solution -->` line on its own splits off the solution:

```markdown
Let $x \ne y$ be positive reals. Prove the inequality.

![incircle](images/incircle.svg)

<!-- solution -->

By AM–GM, $a^2 + b^2 \ge 2ab$, and the claim follows.
```

The problem number and language come from the filename. The file whose `<lang>` matches `_meta.yaml`'s `language` is the **original**; any others (`p1.en.md`, `p1.cs.md`) are **translations**. A translation may be statement-only, but it can only carry a solution if the in-draft original does too.

A draft may **omit the original-language file entirely** and carry only translations — a way to drop, say, `cs`/`en` translations onto a problem that already lives in the DB without re-importing its untouched original. Keep `_meta.yaml`'s `language` set to the problem's **true original language** even when that file is absent; otherwise a translation gets marked as the original and collides with the stored one (a second original is forbidden). With no in-draft original, the "solution only if the original has one" check can't run, so a dropped translated solution is accepted on faith — make sure the stored original already has its own solution, or you'll orphan the translated one.

## Format vs. validate

The preflight here is **DB-blind** — it checks the draft's _format_ (file shape, markdown, math, images) and only that. Whether a subset's numbering fills the round without gaps, or whether a created problem carries its `pN.yaml`, depends on what already exists in the DB — so those calls belong to the C# `validate` step, which queries the DB and can tell a correction or append from a mistake:

- **Round contiguity** — once the import lands, the round's problem orders (those already in the DB plus the draft's) must run `1..N` with no gap. A fresh import that skipped a problem, or a subset drop onto an order that doesn't exist yet, is rejected (`round-contiguity`). A single-problem correction or a clean append passes.
- **New-problem metadata** — a problem the import would **create** must carry a `pN.yaml` sidecar (`missing-problem-meta`). A re-import onto an existing problem may omit it: with no `pN.yaml`, `authors`/`tags`/`solutionLink` default to "leave the stored values untouched", so a draft can hold exactly the problems being corrected and nothing else.
- **Original existence** — a no-original (translation-only) drop is rejected unless its problem already exists (`no-original-new-problem`), and an original in a language other than the stored one is rejected as a second original (`original-conflict`).

Because all of this is DB-aware, `validate` **requires a reachable database** — it fails (rather than warning) when it can't reach one, since a dry run that can't see the DB can't vouch for the import. `apply` likewise needs a live DB.

## Problem metadata — `pN.yaml`

One per problem, shared across its languages. Every field is optional:

```yaml
authors:
  - Jaromír Šimša
solutionLink: https://example.com/p1 # external solution URL
tags: # approved tag slugs; usually written by the Tagging CLI, hand-editable
  - algebra
  - am-gm-inequality
```

`authors` and `tags` share the same omit-vs-clear semantics on apply: an **absent** key leaves a problem's existing values untouched, an **empty** list (`authors: []` / `tags: []`) clears them, and a populated list replaces them. So a partial re-import — say, attaching only a solution — can leave both authors and tags alone by omitting their keys. Each tag slug must be in the approved vocabulary (`approved-tags.json`) — the C# validate step rejects unknown ones.

`solutionLink` follows the same omit-leaves-untouched rule: an **absent** key keeps the stored link, a value sets it. Being a scalar it has no empty-list analogue, so a re-import never clears a link — that's done directly in the DB.

## Images

Put assets in `images/` and reference them with a **bare** ref:

```markdown
![figure](images/diagram.svg) # the figure's intrinsic size is the on-screen size
![equals](images/eq.svg?inline=true) # the one legal query param — flows inline with the text
```

A ref is bare except for an optional `?inline=true` (inline display). `apply` auto-derives `width`/`height` from the figure's own intrinsic dimensions and stamps them on import — so to resize a figure, change the figure itself (an SVG's root `width`/`height` keeping its `viewBox`, or a raster's pixels), never the ref. Writing `width`/`height`/`scale`/any other query param on a ref is a preflight **error** (`image-ref-param`): hand-written dimensions are meaningless (`apply` overrides them) and `scale` has no role on a problem image. Supported formats are **SVG, PNG, JPEG, and WebP**, each under **2 MB** (figures serve unoptimized, so they ship at full weight). Every referenced image must exist on disk; files in `images/` that nothing references produce a warning (not an error). Two images in one problem can't share a name (e.g. `fig.svg` and `fig.png`) — they'd collide on one stored key.

## Markdown & math checks

Each half runs through the same pipeline the site renders with. The preflight reports failures with file and line:

- **Math delimiters** — an odd number of unescaped `$` is an error.
- **Parse** — malformed markdown or directives.
- **KaTeX** — every `$…$` / `$$…$$` must render.
- **Images** — every `images/…` reference must resolve, be a supported format (SVG/PNG/JPEG/WebP), stay under 2 MB, carry no query param other than `?inline=` (`width`/`height`/`scale` are rejected), and not share a stem with another image in the same problem.

## Running the check

From `web/`:

```bash
npm run draft:preflight -- ./my-draft          # human-readable report
npm run draft:preflight -- ./my-draft --json   # machine-readable manifest
```

Exit `0` when clean, `1` on any error. Warnings (e.g. orphan images) don't fail the run. A clean preflight is what the [`apply` command](../../backend/src/MathComps.Cli.BulkImport/README.md) needs to import the draft.

## Examples

`scripts/__fixtures__/preflight-draft/` holds a runnable example per rule: a `valid-*` folder for each shape that passes, and an `invalid-*` folder for each error.
