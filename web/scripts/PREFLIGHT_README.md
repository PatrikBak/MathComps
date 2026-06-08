# Draft folder format

How competition problems are authored for bulk import. A **draft folder** holds one round's problems as plain files; `npm run draft:preflight <folder>` checks it, and the [bulk-import CLI](../../backend/src/Tools/MathComps.Cli.BulkImport/README.md) imports it. The preflight here is the single source of truth for the format — the C# side never re-parses the folder, it consumes this script's JSON manifest.

## Layout

```
my-draft/
  _meta.yaml        # round-level taxonomy (one per folder)
  p1.sk.md          # problem 1 body, in language "sk"
  p1.en.md          # optional translations of problem 1
  p1.yaml           # problem 1 metadata (one per problem, shared across languages)
  p2.sk.md
  p2.yaml
  images/           # referenced images (optional)
    incircle.svg
```

Problems are numbered from 1 and must be contiguous (`p1`, `p2`, …).

## `_meta.yaml`

Round-level taxonomy, all slugs (display names live in the registry, not here):

```yaml
competition: csmo # competition slug
category: a # category slug — omit for competitions with no categories
round: iii # round slug
season:
  year: 2024 # calendar year the season starts
date: 2024-03-15 # round-instance date, YYYY-MM-DD
language: sk # the draft's original language: sk | cs | en
```

## Problem body — `pN.<lang>.md`

Markdown with inline TeX. **No frontmatter** — metadata lives in `pN.yaml`. The statement comes first; an optional `<!-- solution -->` line on its own splits off the solution:

```markdown
Let $x \ne y$ be positive reals. Prove the inequality.

![incircle](images/incircle.svg)

<!-- solution -->

By AM–GM, $a^2 + b^2 \ge 2ab$, and the claim follows.
```

The problem number and language come from the filename. The file whose `<lang>` matches `_meta.yaml`'s `language` is the **original**; any others (`p1.en.md`, `p1.cs.md`) are **translations**. A translation may be statement-only, but it can only carry a solution if the original does too.

## Problem metadata — `pN.yaml`

One per problem, shared across its languages. Both fields are optional:

```yaml
authors:
  - Jaromír Šimša
solutionLink: https://example.com/p1 # external solution URL
```

## Images

Put assets in `images/` and reference them relatively. Sizing is optional:

```markdown
![figure](images/diagram.svg) # fluid
![figure](images/diagram.svg?width=400&height=300) # fixed intrinsic size
```

`width`/`height` are positive integers and must be given together; `?inline=true` renders inline with surrounding text; `?scale=50` shrinks to a percentage. Supported formats are **SVG, PNG, JPEG, and WebP**, each under **2 MB** (figures serve unoptimized, so they ship at full weight). Every referenced image must exist on disk; files in `images/` that nothing references produce a warning (not an error). Two images in one problem can't share a name (e.g. `fig.svg` and `fig.png`) — they'd collide on one stored key.

## Markdown & math checks

Each half runs through the same pipeline the site renders with. The preflight reports failures with file and line:

- **Math delimiters** — an odd number of unescaped `$` is an error.
- **Parse** — malformed markdown or directives.
- **KaTeX** — every `$…$` / `$$…$$` must render.
- **Images** — every `images/…` reference must resolve, be a supported format (SVG/PNG/JPEG/WebP), stay under 2 MB, and not share a stem with another image in the same problem.

## Running the check

From `web/`:

```bash
npm run draft:preflight -- ./my-draft          # human-readable report
npm run draft:preflight -- ./my-draft --json   # machine-readable manifest
```

Exit `0` when clean, `1` on any error. Warnings (e.g. orphan images) don't fail the run. A clean preflight is what the [`apply` command](../../backend/src/Tools/MathComps.Cli.BulkImport/README.md) needs to import the draft.

## Examples

`scripts/__fixtures__/preflight-draft/` holds runnable examples — `valid-basic`, `valid-multilang`, `valid-no-category`, and many `invalid-*` folders that each demonstrate one error.
