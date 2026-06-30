---
name: add-problems
description: Use this skill when adding a competition's problems to the site database through the bulk-import draft pipeline — registering a brand-new competition in the taxonomy if it isn't there yet, authoring the draft folder (statements + solutions + images, one original language plus translations), and running the bulk-import CLI validate until it passes. Trigger phrases: "add a new competition", "import a contest's problems into the DB", "register a competition in the taxonomy", "create a bulk-import draft", "add a round/year of a competition". Do NOT use for editing handouts (use the handout-* skills). The skill ends at `validate`; `apply` runs only on the user's explicit say-so (see "Validate" below).
---

# Add problems (bulk-import draft)

Turn a competition's problems into a validated **draft folder** under `data/problems/` that the bulk-import CLI can apply. **Done = `validate` passes (registry + DB preview running) with the wanted languages present.** A fresh problem needs its original language (plus any translations); a re-import onto problems already in the DB may carry any **subset** — correct one original, or drop translations only (see "What a draft can do" below). Stop at `validate` by default — only run `apply` when the user explicitly tells you to in that instruction.

`data/problems/` is **gitignored** (`data/problems/.gitignore` = `*`) — drafts are local staging input, never committed. The committable artifact is any taxonomy/code change.

The format spec is the single source of truth — read it first: `web/scripts/PREFLIGHT_README.md` (authoring) and `backend/src/MathComps.Cli.BulkImport/README.md` (CLI).

## Draft layout

```
my-draft/
  _meta.yaml        # round taxonomy: competition / category? / round? / season / date / language (the original language, e.g. sk)
  p1.sk.md          # problem 1 in its original language (the locale matching _meta's language): statement, optional "<!-- solution -->", solution
  p1.cs.md          # problem 1 in another locale (cs, en, …) — a translation; statement-only ok, solution only if the original has one
  p1.yaml           # problem 1's authors / solutionLink / tags — all optional; the file itself is required only for a newly-created problem
  images/           # referenced figures (flat): .svg / .png / .jpg / .jpeg / .webp, each < 2 MB
```

Filenames are `p<number>.<locale>.md`, locale one of `sk` / `cs` / `en`. The file whose locale matches `_meta.yaml`'s `language` is the **original** (verbatim); the rest are translations. Keep `language` set to the true original even when that file is absent from the draft — else a translation gets taken as the original and collides with the stored one.

## What a draft can do

Each problem is matched to the DB by slug (`{edition}-{round}-{order}`). The one fork is **does it already exist?**

- **New problem** → the import _creates_ it: it needs its original-language body **and** a `pN.yaml`; translations optional.
- **Existing problem** → the import _patches_ it: ship only the bodies you're changing, and `pN.yaml` is optional (omit = leave authors/tags/link untouched). Statement and solution are independent halves, so adding just a solution is fine.

| Intent | `pN.<orig>.md` (e.g. `p4.sk.md`) | `pN.<trans>.md` (cs/en) | `pN.yaml` |
| --- | --- | --- | --- |
| Create a new problem | required | optional | required |
| Correct an existing original | the corrected body | optional | optional |
| Add / fix a translation (leave the original) | omit | the translation(s) | optional |
| Add a solution to an existing problem | the body, now with `<!-- solution -->` | — | optional |

A full fresh import is `p1..pN` contiguous; a re-import carries any **subset** (e.g. just `p4`, or `p3` + `p7`) since the rest already exist. A draft is just per-problem ops — mix freely; the only cross-problem rule is round contiguity, enforced by `validate` below.

The preflight checks **format only**; the DB-aware `validate` is the gate (so it **needs a reachable DB**). It rejects: an import that would leave the round non-contiguous (`round-contiguity`, e.g. a `p5` whose `p4` doesn't exist yet); a problem it would create with no original (`no-original-new-problem`) or no `pN.yaml` (`missing-problem-meta`); and an original in a different language than the stored one (`original-conflict`). **A brand-new problem with only translations is _not_ valid** — translation-only drops require the problem to already exist.

## Step 1 — Register the competition (only if its slug is new)

Check `backend/src/MathComps.Infrastructure/Resources/metadata.shared.json`. If the competition slug isn't there, add it to **all four** metadata files, or the registry check fails with "no structural entry":

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

**Single-occasion competitions — give every round the same `date`.** When a competition runs all its rounds as one event (MEMO Individual + Team, CPSJ I + T, TST d1–d5), every round's `_meta.yaml` must carry the **same date**. The problem list sorts by event **date first** (newest first), then by round order (`OrderByDefaultProblemSort`: season → date → category-else-competition sort → round sort order → problem number). Because date outranks round order, distinct per-paper dates scatter one occasion's papers by date — the later paper sorts ahead of the earlier one (Team before Individual). A shared date collapses the date key so the round-order key takes over and the papers group in round order (Individual before Team). This is a deliberate data-side convention — don't "correct" the shared date to the real distinct per-paper days, it re-breaks the ordering.

## Step 3 — Write the problems

Each `pN.<lang>.md`: statement (markdown + inline `$…$` / display `$$…$$` TeX), an optional lone `<!-- solution -->` line, then the solution. No frontmatter — metadata lives in `pN.yaml`. Reference images with a **bare** ref — `![alt](images/file.png)` — the only legal query param is `?inline=true` (inline display); `width`/`height`/`scale` on a ref are a preflight error (see "Sizing figures" below). Every `$…$` must render in KaTeX; an odd number of unescaped `$` is an error.

**Statement shape:** the closing question/task is the last sentence of the final text paragraph — not a paragraph of its own. Split it off only when it must follow a block (bullet list, figure, or display math), where there's no sentence to attach it to.

**Transcribe math from a render, not from text extraction.** When the source is a PDF, render its pages to images and read the formulas off the render — the text layer mangles fractions, exponents, and multi-line displays (`bc/a` extracts as `bc a`; a `b³` can read as `b3`/`b2`). Zoom the region to confirm any ambiguous sub/superscript before trusting it. Drop contest-admin lines that aren't part of the problem — "write the solution in language X", per-problem time limits, partial-credit grading notes.

**Multi-language sources** (a contest authored by several countries, e.g. a Czech-Polish-Slovak match) can carry a *different* original language per problem within one round, and the source may even be in a language the site doesn't display (e.g. Polish). The pipeline still wants **one** `language:` per draft, so pick a single canonical original for the round (the source language you transcribed from, or `en` when the real source isn't a display language) and translate the rest — `is_original` is low-value, so don't build per-problem-original machinery for it.

**Figures cut from a PDF** (clip id like `svgselect-region`, or an SVG that's huge for a plain line drawing) often carry the whole page's text as **hidden clipped glyphs** — bloated and embedding unrelated content. Slim to just the figure by dropping the `<defs>` glyph outlines and every `<use>`, keeping the stroked paths. Verify with a before/after render-diff (must be pixel-identical — guards against deleting real labels), and **ask the author before replacing a file they provided**.

**Sizing figures — set the figure's INTRINSIC size, never the ref.** `apply` auto-stamps `?width=&height=` from the figure's own intrinsic dimensions (SVG root `width`/`height` or viewBox; raster = literal pixel size), and that IS the on-screen size (capped to the column). So the ref stays bare, and you resize by changing the figure itself: an **SVG** → set its root `width`/`height` to the target px keeping the `viewBox` (`width="240" height="240" viewBox="0 0 97.56 97.56"`); a **raster** → resize the pixels (and minify — Pillow `resize` + `quantize(colors=16)` + `save(optimize=True)`; a line drawing shrinks ~96%). The preflight rejects `width`/`height`/`scale`/any query param other than `?inline=true` on a ref (`image-ref-param`): hand-written dimensions are meaningless since `apply` derives and overrides them, and `scale` has no role on a problem image. So to change the displayed size, resize the figure itself — never the ref. A bloated giant figure → rebuild a small SVG from PDF vectors (the [extract-figures](../extract-figures/SKILL.md) skill) rather than shipping a huge raster.

## Step 4 — Translate to the other languages (fan out)

Generate the original first, preflight it clean, **then** translate. Spawn parallel `general-purpose` sub-agents, each owning a contiguous range, each writing `pN.<target>.md`, with these hard rules:

- Translate only the natural-language prose; render correct target-language math terminology.
- COPY every `$…$` / `$$…$$` span character-for-character (prose inside `\text{…}` may be translated, keep the wrapper).
- Keep `![alt](images/…)`, the `<!-- solution -->` line, and `---` rules byte-identical and in place; same paragraph count; body only.

Then verify in **two passes** — both mandatory, neither self-graded by the translator agent:

1. **Mechanical parity** (deterministic, you run it): per problem, assert original vs translation have equal `$` count, equal `$$` count, byte-identical `$…$`/`$$…$$` span multiset, identical image-ref set, equal `<!-- solution -->` and `---` counts, and translation ≠ original.
2. **Independent semantic verification** (fan out fresh `general-purpose` agents, blind to the translators' reasoning, covering **every** problem — not a spot-check): each reads original + translation and hunts meaning differences mechanical parity can't catch — flipped quantifiers (for all / for some, exists), negations, a dropped "distinct", "at most" vs "at least", changed domain/range or conditions, wrong proper names. It reports discrepancies; you triage and fix.

Mechanical parity only proves the math and structure survived; a prose-level meaning flip leaves the math byte-identical and sails through it. The semantic pass is where the real translation bugs surface, so it is not optional.

## Step 5 — Tag the draft

Tag the problems before validating, so the preflight checks the slugs:

```bash
dotnet run --project backend/src/MathComps.Cli.Tagging -- ./data/problems/my-draft
```

This writes a `tags:` list into each `pN.yaml`. It skips any problem that already has a `tags:` key, so it's safe to re-run; to redo one, delete its `tags:` key. Names it proposes outside the approved vocabulary land in `tag-suggestions.json` for review, never in a `pN.yaml`. See the [Tagging CLI README](../../../backend/src/MathComps.Cli.Tagging/README.md). Needs `OpenRouter:ApiKey` in that project's user secrets.

## Step 6 — Validate (the goal)

```bash
# Fast inner loop on markdown/KaTeX/images (run from web/):
cd web && npm run draft:preflight -- ../data/problems/my-draft
# Full check (preflight + registry + read-only DB preview):
dotnet run --project backend/src/MathComps.Cli.BulkImport -- validate ./data/problems/my-draft
```

A genuine pass shows the **DB preview** (create/reuse competition, season, round) then `No issues. PASS`. The preflight is the fast loop for body errors; the dotnet validate adds the registry + DB checks (including that every tag slug is in the approved vocabulary).

**`apply` is explicit-only.** Stop at `validate` unless the user tells you to apply in that same instruction — don't run it as a default last step, and don't offer to. `apply` writes to whatever `ConnectionStrings:DefaultConnection` points at, which is **localhost** (the staging DB); promoting to prod needs the connection repointed via the user's tunnel, so that stays user-run. When told to apply, run `dotnet run -c Release --project=backend/src/MathComps.Cli.BulkImport -- apply ./data/problems/my-draft` against localhost.
