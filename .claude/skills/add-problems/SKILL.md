---
name: add-problems
description: Use this skill when adding a competition's problems to the site database through the bulk-import draft pipeline — registering a brand-new competition in the taxonomy if it isn't there yet, authoring the draft folder (statements + solutions + images, one original language plus translations), and running the bulk-import CLI validate until it passes. Trigger phrases: "add a new competition", "import <contest> problems into the DB", "register a competition in the taxonomy", "create a bulk-import draft", "add a round/year of <competition>". Do NOT use for editing handouts (use the handout-* skills), or for running `apply` — the user does apply themselves.
---

# Add problems (bulk-import draft)

Turn a competition's problems into a validated **draft folder** under `data/problems/` that the bulk-import CLI can apply. **Done = `validate` passes (registry + DB preview running) with every problem present in the original language + the wanted translations.** Never run `apply` — the user does that.

`data/problems/` is **gitignored** (`data/problems/.gitignore` = `*`) — drafts are local staging input, never committed. The committable artifact is any taxonomy/code change.

The format spec is the single source of truth — read it first: `web/scripts/PREFLIGHT_README.md` (authoring) and `backend/src/Tools/MathComps.Cli.BulkImport/README.md` (CLI).

## Draft layout

```
my-draft/
  _meta.yaml        # competition / category? / round? / season / date / language
  p1.<lang>.md      # statement, then an optional "<!-- solution -->" line, then the solution
  p1.<lang2>.md     # translations (statement-only allowed; solution only if the original has one)
  p1.yaml           # authors / solutionLink — both optional, but the file must exist
  images/           # referenced figures (flat): .svg / .png / .jpg / .jpeg / .webp, each < 2 MB
```

Problems are numbered from 1, contiguous. The file whose `<lang>` matches `_meta.yaml`'s `language` is the **original** (verbatim); the rest are translations.

## Step 1 — Register the competition (only if its slug is new)

Check `backend/src/Infrastructure/MathComps.Infrastructure/Resources/metadata.shared.json`. If the competition slug isn't there, add it to **all four** metadata files, or the registry check fails with "no structural entry":

- `metadata.shared.json` — structure: `{ "slug": "...", "categories": [...] | null, "rounds": [...] }`. Array position = sort order.
- `metadata.{cs,sk,en}.json` — `competitions["slug"] = { shortName, fullName }`, plus a `rounds["<composite>"]` entry per round, and a `categories["x"]` entry per category.

Decide the shape:
- **Categories** (age/level bands like `a`,`b`,`z9`) → list them in `shared.categories` for the competition; omit `category:` in drafts that don't use them.
- **Rounds** (`i`,`ii`,`iii`, `d1`…) → list them; the composite round slug is `{competition}[-{category}]-{round}` and needs a localized name in every locale.
- **Default round** — a competition that is one flat sitting (no sub-rounds, like IMO/EGMO) takes `"rounds": []`. Then `_meta.yaml` **omits `round:`** entirely, the round resolves to the competition's own name, and no `rounds[...]` locale entry is needed. (Gotcha below.)

Add a test row for any new competition/round/name to `MetadataLocalizationServiceTests` (display order, default-round/category shape, name resolution, `Registered_taxonomy_has_no_issues`).

## Step 2 — Author `_meta.yaml`

```yaml
competition: csmo   # competition slug
category: b         # omit for category-less competitions
round: ii           # omit for a default-round competition
season:
  year: 2025        # academic season START year — a SPRING event belongs to the previous autumn's season
date: 2026-03-31    # the round-instance date, YYYY-MM-DD
language: sk         # the draft's original language: sk | cs | en
```

Season year is the academic start, not the event year: a March-2026 event ⇒ `year: 2025` (ročník = year − 1950, shared across competitions by design — it is not each competition's own edition count).

## Step 3 — Write the problems

Each `pN.<lang>.md`: statement (markdown + inline `$…$` / display `$$…$$` TeX), an optional lone `<!-- solution -->` line, then the solution. No frontmatter — metadata lives in `pN.yaml`. Reference images as `![alt](images/file.png)` (sizing optional: `?width=&height=` together, or `?scale=`). Every `$…$` must render in KaTeX; an odd number of unescaped `$` is an error.

## Step 4 — Translate to the other languages (fan out)

Generate the original first, preflight it clean, **then** translate. Spawn parallel `general-purpose` sub-agents, each owning a contiguous range, each writing `pN.<target>.md`, with these hard rules:

- Translate only the natural-language prose; render correct target-language math terminology.
- COPY every `$…$` / `$$…$$` span character-for-character (prose inside `\text{…}` may be translated, keep the wrapper).
- Keep `![alt](images/…)`, the `<!-- solution -->` line, and `---` rules byte-identical and in place; same paragraph count; body only.

Then **verify parity yourself** (don't trust the agents): per problem, assert original vs translation have equal `$` count, equal `$$` count, identical image-ref set, equal `<!-- solution -->` and `---` counts, and translation ≠ original.

## Step 5 — Validate (the goal)

```bash
# Fast inner loop on markdown/KaTeX/images (run from web/):
cd web && npm run draft:preflight -- ../data/problems/my-draft
# Full check (preflight + registry + read-only DB preview):
dotnet run --project backend/src/Tools/MathComps.Cli.BulkImport -- validate ./data/problems/my-draft
```

A genuine pass shows the **DB preview** (create/reuse competition, season, round) then `No issues. PASS`. The preflight is the fast loop for body errors; the dotnet validate adds the registry + DB checks. **Never run `apply`** — that's the user's call.
