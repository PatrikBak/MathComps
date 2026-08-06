---
name: handout-finalize
description: Use this skill to finalize a handout — add a completed one to the site index and build it. Appends its entry to web/src/content/handouts.json, runs the Handouts CLI to build the content JSONs and PDFs, and validates. Trigger words — "finalize", "publish", "release", "ship" a handout. Do NOT use for writing or editing .tex content — use the `handout-editor` skill for that. The R2 upload is user-gated; this skill builds with --skip-upload until told otherwise.
---

# Handout Finalizer

The user will name the handout (base filename, e.g. `adding-points`) or point at the `.tex` file(s), which are already final. Discover all `<base>.*.tex` in `data/handouts/` — those define the declared languages.

## Workflow

### 1. Derive everything the `.tex` settles

**Read the schema first, and treat it as the authority over this skill.** `web/src/components/features/handouts/handout-metadata-types.ts` defines the entry shape and `web/scripts/validate-handouts.ts` enforces it; the field notes below are a convenience copy and have been wrong before. Neither file is yours to edit: when validation fails, the entry is wrong, not the validator. Enumerate every field the type declares, then:

- **Derivable** (from the `.tex`, the schema, or today's date) → derive it, never ask.
- **Editorial** (where it's filed, who it's pitched at, what stays hidden) → ask it in step 2, however plausible your guess looks. Nothing in the `.tex` is evidence about these, and a wrong one passes every gate on its way to the live site.
- **Required and neither derivable nor listed in step 2** → **ask anyway**, naming the field and why you can't settle it. The alternative is omitting it, and validate catches that only because it's missing.
- **A field in the schema that this skill doesn't mention at all** → the schema moved. Ask, and flag that this skill needs updating.

Read `web/src/content/handouts.json` and list `data/handouts/<base>.*.tex`. From each `.{locale}.tex`, extract:

- **locale** ← `\setlanguage{SK|CS|EN}` → lowercase (cross-check against filename)
- **title[locale]** ← `\Title{...}`
- **slug[locale]** ← `\MathcompsLink{...}`
- **authors** ← `\Author{...}` (must agree across locales)

Then derive the rest:

- **`publishedAt` / `updatedAt`** — both required, `YYYY-MM-DD`, with `updatedAt >= publishedAt`. For a new handout set both to today.
- **Description per locale** — write one yourself from the `.tex` intro (`\sec Introduction` / `\sec Úvod`) and section headings. 1–3 sentences, SEO/OG-grade, matching the terse factual style of existing entries. Write each locale natively from that locale's .tex; do not machine-translate. Describe topics and techniques, never volatile facts that go stale — no problem counts ("24 problems"), no "N sections", etc.
- **`languages`** — set to the locales that have a `.tex` file only if that is a strict subset of `sk`, `cs`, `en`. If all three exist, omit.
- **`fileSlug`** — set to `<base>` only if there is no English `.tex`; otherwise omit.
- **`public`** — omit unless the user has said the handout is unlisted.

### 2. Ask what the source doesn't settle

Three values, one **single** `AskUserQuestion` call, before any file is touched. Mark your suggestion and its one-line reason in that option's description; never apply it yourself.

- **Section** — the `categoryKey` of the section the entry is appended to: `general`, `algebra`, `geometry`, `number-theory`, `combinatorics`. That's five and the tool takes four, so offer the plausible ones (topic cues: factoring/inequalities → `algebra`; angles/triangles → `geometry`; divisibility/primes → `number-theory`; counting/coloring/invariants → `combinatorics`; proof basics/induction → `general`) and let the auto-added "Other" cover the rest.
- **`difficulty`** — required, `1`, `2` or `3` (`HANDOUT_DIFFICULTY_LEVELS`); the validator rejects anything else. Offer all three in numeric order, never reordered, each labelled with the legend readers actually see (`handouts.difficulty.level1..3` in `web/messages/sk.json`): 1 = beginners (category C and up), 2 = intermediate (category B and up), 3 = advanced (category A). Anchors already in `handouts.json`: `angle-basics-1`, `factorization`, `digits` = 1; `introduction-to-inequalities`, `combinatorial-games` = 2; `power-of-a-point`, `inverses-mod-p`, `functional-equations` = 3.
- **`hideSolutionsAndProofs`** — publish the solutions or keep them hidden. `true` keeps solutions, proofs, answers and the full-solutions PDF off the page; hints and the skeleton PDF stay. Suggest hiding when the solutions are unreviewed or the handout is about to be lectured.

### 3. Generate the `id` and edit `handouts.json`

Run `cd web && npx nanoid` to produce a 21-char nanoid. Never invent one or reuse an existing one.

Write the entry matching the field order, 2-space indent, and trailing-newline style of surrounding entries:

```json
{
  "id": "<nanoid>",
  "slug": { ... },
  "title": { ... },
  "description": { ... },
  "difficulty": 1,
  "authors": [ ... ],
  "publishedAt": "YYYY-MM-DD",
  "updatedAt": "YYYY-MM-DD"
}
```

Optional fields, only when applicable: `"public": false` goes BEFORE `"id"`; the rest go after it, in this order: `"hideSolutionsAndProofs": true`, `"languages": [...]`, `"eventId": "..."`, `"fileSlug": "..."`.

Append to the chosen section's `handouts` array, and leave every other entry in the file alone. There is no `status` field and no promotion path — an entry exists or it doesn't.

### 4. Run the Handouts CLI

From the repo root:

```bash
dotnet run --project backend/src/MathComps.Cli.Handouts -- <base>.*.tex
```

Scope the glob to this handout. If `_common.asy` changed in a way that alters existing figures (a palette shade, a modified primitive), add `--force-asy` — the CLI keeps that file out of its staleness graph and otherwise reports every figure fresh. **Pass `--skip-upload` for the build/validate loop** — R2 assets go live immediately with no deploy, so the upload is the user's call. Re-run without the flag only once they say to publish, and never set up the R2 credentials yourself. Exit code 0 = success.

### 5. Handle CLI failures

The CLI exits 1 on compile failures, unknown commands, or a failed environment-index regeneration (that last one usually means `web/` dependencies aren't installed — run `npm install` there).

**Compile failures:** stop and surface the failing file(s) to the user. Do not try to fix `.tex` content here and do not quote the TeX log — it's noise.

**Unknown commands:** the CLI prints a `Source File` → `\command` table.

`backend/src/MathComps.TexParser/TexCleaner/tex_cleaner_rules.txt` decides how each command crosses from the `pdfcsplain` source world into KaTeX. Apply your judgment per row (do not ask), then report one line per decision:

| Situation | Action |
| --- | --- |
| Standard command the source uses and KaTeX also understands (e.g. `\cosh`, `\arctan`, `\mathfrak`) | Add the bare name to `[leave]`. |
| PlainTeX/OPmac/AMS-TeX or project-shorthand macro that doesn't exist in KaTeX but has a canonical KaTeX equivalent reusable across handouts (e.g. `\uhol` → `\angle`, `\Bbb` → `\mathbb`, `\root…\of` → `\sqrt[…]`) | Add a `[substitute]` rule using `PATTERN => REPLACEMENT`. Mirror existing regex style (`(?![A-Za-z])` lookahead). Language-free replacements only. |
| Macro that expands to a **caption**, i.e. a word that differs per language, like `\Remark` | Add it to *every* `[substitute:<locale>]` section, each with that locale's own wording. |
| PDF-only layout/spacing command with no meaning on the web (e.g. `\smallskip`, custom `\*skip` variants) | Add to `[remove]`. |
| Typo, one-off non-standard macro, or a case where the source should just use a canonical KaTeX-friendly command directly | Fix the `.tex` file(s). |

Rule of thumb: the macro genuinely bridges source→web and other handouts will hit it too → cleaner rule; idiosyncratic to this one file or simply wrong → fix the handout so the source stays KaTeX-clean.

**Before editing the rules file**, re-read it to preserve section order, comment style, and regex conventions. Never reorder or dedupe existing entries.

**A shared `[substitute]` replacement must be language-free.** The shared section cleans all three language variants, so a replacement holding a word writes that word into every language's JSON while the PDF keeps rendering the caption from `\captionRemark` and friends — wrong on the web only, in the languages nobody proofreads. Captions belong in the `[substitute:sk]` / `[substitute:cs]` / `[substitute:en]` sections, one entry per locale, worded as the matching `\definecaptions*` block in `data/handouts/_template.tex` words it. Those sections must declare the same patterns in the same order; the CLI refuses to run otherwise. Nothing checks the wording itself, so copy it from `_template.tex` instead of translating it yourself.

Re-run the CLI on the same scoped glob until exit 0. **Never add `--no-build` to that loop**: the rules file is a content item copied into `bin/`, so skipping the build runs the previous copy. The edit appears to have done nothing, the run still exits 0, and the next move is hunting a phantom bug in a regex that was never applied.

**Missing `\EnvId`:** the parser throws before anything else runs, so this surfaces as a step-4 failure listing every unmarked environment. Nothing downstream fills these in — add the ids to the `.tex` yourself, then re-run the CLI, which also regenerates the environment index. The format is `\EnvId{<nanoid>-<name>}`: the 21-character nanoid is the identity, identical in every language variant and never re-minted, dropped or rewritten once it exists; the name after it is that language's own, must be unique within its file, and lands in the page URL — so name it from what the statement visibly says, never its competition source, its solution technique, or the answer.

### 6. Validate

```bash
cd web && npm run handouts:validate
```

Must exit 0. Typical failures: missing content file (CLI didn't run for that locale), duplicate slug, orphan file, missing field for a declared language, a missing/duplicate `\EnvId`, or a stale `handout-env-index.json`.

### 7. Report

One short summary: entry added, chosen section, generated JSONs in `web/src/content/handouts/`, cleaner-rules changes, environment ids named. Use clickable paths.
