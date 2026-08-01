---
name: handout-finalize
description: Use this skill to finalize a handout — add a completed one to the site index and build it. Appends its entry to web/src/content/handouts.json, runs the Handouts CLI to build the content JSONs and PDFs, and validates. Trigger words — "finalize", "publish", "release", "ship" a handout. Do NOT use for writing or editing .tex content — use the `handout-editor` skill for that. The R2 upload is user-gated; this skill builds with --skip-upload until told otherwise.
---

# Handout Finalizer

You are finalizing a handout: taking completed `.tex` file(s) in `data/handouts/` and turning them into a published entry on the site.

This skill assumes the `.tex` files are already final.

---

## Input

The user will name the handout (base filename, e.g. `adding-points`) or point at the `.tex` file(s). From that, discover all `<base>.*.tex` files in `data/handouts/` — those define the declared languages. Everything else is derived during the workflow below.

---

## Workflow

### 1. Discover and derive

**Read the schema first, and treat it as the authority over this skill.** `web/src/components/features/handouts/handout-metadata-types.ts` defines the entry shape and `web/scripts/validate-handouts.ts` enforces it; the field notes below are a convenience copy and have been wrong before. Enumerate every field the type declares, then:

- **Derivable** (from the `.tex`, the schema, or today's date) → derive it, never ask.
- **A judgment call you can make** (category, difficulty, description) → make it and say so in the report.
- **Anything else that is required and that you cannot derive with confidence** → **ask**, naming the field and why you can't settle it. A required field you neither derived nor asked about is the failure mode: it either gets omitted (validate fails) or guessed (validate passes and the site is wrong).
- **A field in the schema that this skill doesn't mention at all** → that means the schema moved. Ask, and flag that this skill needs updating.

Then read `web/src/content/handouts.json` and list `data/handouts/<base>.*.tex`. From each `.{locale}.tex`, extract:

- **locale** ← `\setlanguage{SK|CS|EN}` → lowercase (cross-check against filename)
- **title[locale]** ← `\Title{...}`
- **slug[locale]** ← `\MathcompsLink{...}`
- **authors** ← `\Author{...}` (must agree across locales)

Then decide:

- **Section** — pick by the section's `categoryKey`, one of `general`, `algebra`, `geometry`, `number-theory`, `combinatorics`. Guess from the handout's topic: factoring/inequalities → `algebra`; angles/triangles → `geometry`; divisibility/primes → `number-theory`; counting/coloring/invariants → `combinatorics`; proof basics/induction → `general`.
- **`difficulty`** — required, one of `1`, `2`, `3` (`HANDOUT_DIFFICULTY_LEVELS`). Judge from the problem sources and the `\sec Úvod`; the validator rejects anything else.
- **`publishedAt` / `updatedAt`** — both required, `YYYY-MM-DD`, with `updatedAt >= publishedAt`. For a new handout set both to today.
- **Description per locale** — write one yourself from the `.tex` intro (`\sec Introduction` / `\sec Úvod`) and section headings. 1–3 sentences, SEO/OG-grade, matching the terse factual style of existing entries. Write each locale natively from that locale's .tex; do not machine-translate. Describe topics and techniques, never volatile facts that go stale — no problem counts ("24 problems"), no "N sections", etc.
- **`languages`** — set to the locales that have a `.tex` file only if that is a strict subset of `sk`, `cs`, `en`. If all three exist, omit.
- **`fileSlug`** — set to `<base>` only if there is no English `.tex`; otherwise omit.
- **`public`** — omit unless the user has said the handout is unlisted.
- **`hideSolutionsAndProofs`** — ask the user whether to ship the solutions with it. `true` keeps solutions, proofs, answers and the full-solutions PDF off the page (hints and the skeleton PDF stay); omit to publish them. Worth asking whenever the solutions are unreviewed or the handout is about to be lectured.

### 2. Generate the `id` and edit `handouts.json`

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

Append to the chosen section's `handouts` array. There is no `status` field and no promotion path — an entry exists or it doesn't.

### 3. Run the Handouts CLI

From the repo root:

```bash
dotnet run --project backend/src/MathComps.Cli.Handouts -- <base>.*.tex
```

Scope the glob to this handout. **Pass `--skip-upload` for the build/validate loop** — R2 assets go live immediately with no deploy, so the upload is the user's call. Re-run without the flag only once they say to publish. Exit code 0 = success.

### 4. Handle CLI failures

The CLI exits 1 on compile failures, unknown commands, or a failed environment-index regeneration (that last one usually means `web/` dependencies aren't installed — run `npm install` there).

**Compile failures:** stop and surface the failing file(s) to the user. Do not try to fix `.tex` content here and do not quote the TeX log — it's noise.

**Unknown commands:** the CLI prints a `Source File` → `\command` table.

`backend/src/MathComps.TexParser/TexCleaner/tex_cleaner_rules.txt` decides how each command crosses from the `pdfcsplain` source world into KaTeX. Apply your judgment per row (do not ask), then report one line per decision:

| Situation | Action |
| --- | --- |
| Standard command the source uses and KaTeX also understands (e.g. `\cosh`, `\arctan`, `\mathfrak`) | Add the bare name to `[leave]`. |
| PlainTeX/OPmac/AMS-TeX or project-shorthand macro that doesn't exist in KaTeX but has a canonical KaTeX equivalent reusable across handouts (e.g. `\uhol` → `\angle`, `\Bbb` → `\mathbb`, `\root…\of` → `\sqrt[…]`) | Add a `[substitute]` rule using `PATTERN => REPLACEMENT`. Mirror existing regex style (`(?![A-Za-z])` lookahead). |
| PDF-only layout/spacing command with no meaning on the web (e.g. `\smallskip`, custom `\*skip` variants) | Add to `[remove]`. |
| Typo, one-off non-standard macro, or a case where the source should just use a canonical KaTeX-friendly command directly | Fix the `.tex` file(s). |

Rule of thumb: the macro genuinely bridges source→web and other handouts will hit it too → cleaner rule; idiosyncratic to this one file or simply wrong → fix the handout so the source stays KaTeX-clean.

Re-run the CLI on the same scoped glob until exit 0.

**Missing `\EnvId`:** the parser throws before anything else runs, so this surfaces as a step-3 failure listing every unmarked environment. It's a bug in the source, not something this skill backfills: add the ids yourself, then re-run the CLI, which also regenerates the environment index. The format is `\EnvId{<nanoid>-<name>}`: the 21-character nanoid is the identity, identical in every language variant and never re-minted, dropped or rewritten once it exists; the name after it is that language's own, must be unique within its file, and lands in the page URL — so name it from what the statement visibly says, never its competition source, its solution technique, or the answer.

### 5. Validate

```bash
cd web && npm run handouts:validate
```

Must exit 0. Typical failures: missing content file (CLI didn't run for that locale), duplicate slug, orphan file, missing field for a declared language, a missing/duplicate `\EnvId`, or a stale `handout-env-index.json`.

### 6. Report

One short summary: entry added, chosen section, generated JSONs in `web/src/content/handouts/`, cleaner-rules changes, environment ids named. Use clickable paths.

## Rules

- **Never touch other handout entries** in `handouts.json` beyond the one being finalized.
- **Never commit or push, never configure R2 credentials, never modify `handout-metadata-types.ts` or the validation script.**
- **Before editing the cleaner-rules file**, re-read it to preserve section order, comment style, and regex conventions. Never reorder or dedupe existing entries.
- **Never ask for confirmation of a value you derived** — but **do** ask about a required schema field you couldn't derive, or one this skill doesn't document (step 1). Those are different things: the first is noise, the second is the skill admitting the schema moved out from under it. The one standing question is `hideSolutionsAndProofs`: nothing in the `.tex` says whether the solutions are ready to be seen.
