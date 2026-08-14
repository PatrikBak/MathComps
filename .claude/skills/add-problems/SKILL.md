---
name: add-problems
description: Use this skill when adding a competition's problems to the site database through the bulk-import draft pipeline — registering a brand-new competition in the taxonomy if it isn't there yet, authoring the draft folder (statements + solutions + images, one original language plus translations), and running the bulk-import CLI validate until it passes. Trigger phrases — "add a new competition", "import a competition's problems into the DB", "register a competition in the taxonomy", "create a bulk-import draft", "add a round/year of a competition". Do NOT use for editing handouts (use the handout-* skills). The skill ends at `validate`; `apply` runs only on the user's explicit say-so.
---

# Add problems (bulk-import draft)

Turn a competition's problems into a validated **draft folder** under `data/problems/` that the bulk-import CLI can apply. **Done = `validate` passes (registry + DB preview running) with the wanted languages present.** Stop at `validate` by default — only run `apply` when the user explicitly tells you to in that instruction.

`data/problems/` is **gitignored** (`data/problems/.gitignore` = `*`) — drafts are local staging input, never committed. The committable artifact is any taxonomy/code change.

The format spec is the single source of truth — read it first: `web/scripts/PREFLIGHT_README.md` (authoring) and `backend/src/MathComps.Cli.BulkImport/README.md` (CLI).

## Draft layout

```
my-draft/
  _meta.yaml        # the competition's path + season / date / language (the original language, e.g. sk)
  p1.sk.md          # problem 1 in its original language (the locale matching _meta's language): statement, optional "<!-- solution -->", solution
  p1.cs.md          # problem 1 in another locale (cs, en, …) — a translation; statement-only ok, solution only if the original has one
  p1.yaml           # problem 1's authors / solutionLink / tags — all optional; the file itself is required only for a newly-created problem
  images/           # referenced figures (flat): .svg / .png / .jpg / .jpeg / .webp, each < 2 MB
```

Filenames are `p<number>.<locale>.md`, locale one of `sk` / `cs` / `en`. The file whose locale matches `_meta.yaml`'s `language` is the **original** (verbatim); the rest are translations. Keep `language` set to the true original even when that file is absent from the draft — else a translation gets taken as the original and collides with the stored one.

## What a draft can do

Each problem is matched to the DB by slug (`{edition}-{competitionPath}-{order}`). The one fork is **does it already exist?**

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

- `metadata.shared.json` — a tree of nodes, `{ "nodes": [ { "slug": "csmo", "children": [ … ] } ] }`. Array position = sort order **at every level**, and `children` is omitted at a leaf.
- `metadata.{cs,sk,en}.json` — one `nodes["<path>"] = { shortName, fullName }` entry per node, a path being the slugs from the competition down, hyphen-joined: the competition (`csmo`), each of its categories (`csmo-a`), and each round (`csmo-a-iii`, `memo-i`).

**The two files must list exactly the same paths** — a test asserts it in both directions, so a node added to one and forgotten in the other fails the suite.

Decide the shape. The tree nests as deep as the competition really does — three levels is the deepest anything runs today, not a ceiling:
- **Categories** (age/level bands like `a`,`b`,`z9`) → the competition's `children`, when it has them at all. Each carries its own `nodes["{competition}-{category}"]` name.
- **Rounds** (`i`,`ii`,`iii`, `d1`…) → the `children` of whatever they hang under, which is the category when there is one and the competition otherwise. **Each parent lists only the rounds it actually runs**, so CSMO's Z4 carries just `i`, `ii` while its A carries `i`, `s`, `ii`, `iii`.
- **One flat sitting** — a competition with no sub-rounds (IMO/EGMO) omits `children` entirely; its problems hang off the competition itself, and its own `nodes` entry is the only name needed.

Every slug is lowercase alphanumeric with **no hyphen in it** — a hyphen is what joins a slug to its parent's path, so one inside a slug would make the path ambiguous. Path composition throws on it, and a check constraint refuses the row underneath.

Add a test row for any new competition/round/name to `MetadataLocalizationServiceTests` (display order, leaf/child shape, name resolution, `Registered_taxonomy_has_no_issues`). A new root also needs its slug in `Shared_roots_are_in_display_order`; the parity sweep walks the registry itself, so it needs no edit.

## Step 2 — Author `_meta.yaml`

```yaml
competition: csmo-b-ii  # the competition's path
season:
  year: 2025        # academic season START year — a SPRING event belongs to the previous autumn's season
date: 2026-03-31    # the round date, YYYY-MM-DD
language: sk        # the draft's original language: sk | cs | en
```

`competition` is the path from Step 1: the slugs from the root of the taxonomy down to the competition the problems were set in, hyphen-joined, however many that is. `csmo-b-ii` is round II of category B; `memo-i` is a round of a competition with no categories; `imo` is a competition that runs as one flat sitting. Two rules the registry check enforces:

- **Every competition on the path must be registered** — `csmo-b-ii` needs `csmo`, `csmo-b` and `csmo-b-ii` all present in the shared tree and named in all three locales, or you get one error per missing one.
- **The competition must be a leaf.** Naming `csmo-b` when it carries rounds fails with "has competitions nested below it" — those rounds are what a draft picks from, since problems hang off a sitting, not off a container.

Season year is the academic start, not the event year: a March-2026 event ⇒ `year: 2025` (ročník = year − 1950, shared across competitions by design — it is not each competition's own edition count).

**Single-occasion competitions — give every round the same `date`.** When a competition runs all its rounds as one event (MEMO Individual + Team, CPSJ I + T, TST d1–d5), every round's `_meta.yaml` must carry the **same date**. The problem list sorts by event **date first** (newest first), then by round order (`OrderByDefaultProblemSort`: season → date → the competition's sort path → problem number). Because date outranks round order, distinct per-paper dates scatter one occasion's papers by date — the later paper sorts ahead of the earlier one (Team before Individual). A shared date collapses the date key so the round-order key takes over and the papers group in round order (Individual before Team). This is a deliberate data-side convention — don't "correct" the shared date to the real distinct per-paper days, it re-breaks the ordering.

## Step 3 — Write the problems

Each `pN.<lang>.md`: statement (markdown + inline `$…$` / display `$$…$$` TeX), an optional lone `<!-- solution -->` line, then the solution. No frontmatter — metadata lives in `pN.yaml`. Reference images with a **bare** ref — `![alt](images/file.png)` — the only legal query param is `?inline=true` (inline display); `width`/`height`/`scale` on a ref are a preflight error (see "Sizing figures" below). Every `$…$` must render in KaTeX; an odd number of unescaped `$` is an error.

**Statement shape:** the closing question/task is the last sentence of the final text paragraph — not a paragraph of its own. Split it off only when it must follow a block (bullet list, figure, or display math), where there's no sentence to attach it to.

**Transcribe math from a render, not from text extraction.** When the source is a PDF, render its pages to images and read the formulas off the render — the text layer mangles fractions, exponents, and multi-line displays (`bc/a` extracts as `bc a`; a `b³` can read as `b3`/`b2`). Zoom the region to confirm any ambiguous sub/superscript before trusting it. Drop competition-admin lines that aren't part of the problem — "write the solution in language X", per-problem time limits, partial-credit grading notes.

**Multi-language sources** (a competition authored by several countries, e.g. a Czech-Polish-Slovak match) can carry a *different* original language per problem within one round, and the source may even be in a language the site doesn't display (e.g. Polish). The pipeline still wants **one** `language:` per draft, so pick a single canonical original for the round (the source language you transcribed from, or `en` when the real source isn't a display language) and translate the rest — `is_original` is low-value, so don't build per-problem-original machinery for it.

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

This writes a `tags:` list into each `pN.yaml`. It skips any problem that already has a `tags:` key, so it's safe to re-run; to redo everything pass `--retag`, or to redo one problem delete its `tags:` key. Names it proposes outside the approved vocabulary land in `tag-suggestions.json` for review, never in a `pN.yaml`. See the [Tagging CLI README](../../../backend/src/MathComps.Cli.Tagging/README.md). Needs `Llm:ApiKey` in that project's user secrets.

## Step 6 — Validate (the goal)

```bash
# Fast inner loop on markdown/KaTeX/images (run from web/):
cd web && npm run draft:preflight -- ../data/problems/my-draft
# Full check (preflight + registry + read-only DB preview):
dotnet run --project backend/src/MathComps.Cli.BulkImport -- validate ./data/problems/my-draft
```

A genuine pass shows the **DB preview** (create/reuse competition, season, round) then `No issues. PASS`. The preflight is the fast loop for body errors; the dotnet validate adds the registry + DB checks (including that every tag slug is in the approved vocabulary).

**`apply` is explicit-only.** Stop at `validate` unless the user tells you to apply in that same instruction — don't run it as a default last step, and don't offer to. `apply` writes to whatever `ConnectionStrings:DefaultConnection` points at, which is **localhost** (the staging DB); promoting to prod needs the connection repointed via the user's tunnel, so that stays user-run. When told to apply, run `dotnet run -c Release --project=backend/src/MathComps.Cli.BulkImport -- apply ./data/problems/my-draft` against localhost.
