---
name: handout-finalize
description: Use this skill to finalize a handout — promote it from draft to published. Updates web/src/content/handouts.json, runs the Handouts CLI to build JSONs/PDFs, and validates. Trigger words: "finalize", "publish", "release", "ship" a handout. Do NOT use for writing or editing .tex content — use the `handout-editor` skill for that.
---

# Handout Finalizer

You are finalizing a handout: taking completed `.tex` file(s) in `data/handouts/` and turning them into a published entry on the site. This means updating `web/src/content/handouts.json`, running the Handouts CLI (which produces content JSONs and uploads PDFs/images to R2), and running validation.

This skill assumes the `.tex` files are already final. Never ask the user to confirm derived values; only ask when genuinely blocked by inconsistent source (see Rules).

---

## Input

The user will name the handout (base filename, e.g. `adding-points`) or point at the `.tex` file(s). From that, discover all `<base>.*.tex` files in `data/handouts/` — those define the declared languages. Everything else is derived during the workflow below.

---

## Workflow

### 1. Discover and derive

Read `web/src/content/handouts.json` and list `data/handouts/<base>.*.tex`. From each `.{locale}.tex`, extract:

- **locale** ← `\setlanguage{SK|CS|EN}` → lowercase (cross-check against filename)
- **title[locale]** ← `\Title{...}`
- **slug[locale]** ← `\MathcompsLink{...}`
- **authors** ← `\Author{...}` (must agree across locales)

Then decide:

- **`source` / `eventId`** — default `"source": "matikaCesku"` with no `eventId`. Only if the user says the handout was made for an event, set `"source": "events"` and `eventId` to the matching entry in the index's top-level `events` array (match by name; no match → ask the user whether to add the event).
- **Category** — guess from the existing sections and the handout's topic. Hints: factoring/inequalities → Algebra; angles/triangles → Geometria; divisibility/primes → Teória čísel; counting/coloring/invariants → Kombinatorika; proof basics/induction → Všeobecné. If an existing `"status": "planned"` entry in any section matches the title, replace it in place and keep its section.
- **Description per locale** — write one yourself from the `.tex` intro (`\sec Introduction` / `\sec Úvod`) and section headings. 1–3 sentences, SEO/OG-grade, matching the terse factual style of existing entries. Write each locale natively from that locale's .tex; do not machine-translate.
- **`languages`** — set to the locales that have a `.tex` file only if that is a strict subset of `sk`, `cs`, `en`. If all three exist, omit.
- **`fileSlug`** — set to `<base>` only if there is no English `.tex`; otherwise omit.
- **`public`** — omit unless the user has said the handout is unlisted.

### 2. Generate the `id` and edit `handouts.json`

Run `cd web && npx nanoid` to produce a 21-char nanoid. Never invent one or reuse an existing one.

Write the entry matching the field order, 2-space indent, and trailing-newline style of surrounding entries:

```json
{
  "status": "ready",
  "source": "<matikaCesku|events>",
  "id": "<nanoid>",
  "slug": { ... },
  "title": { ... },
  "description": { ... },
  "authors": [ ... ]
}
```

Optional fields, only when applicable, inserted in this order after `id`: `"public": false`, `"languages": [...]`, `"eventId": "..."`, `"fileSlug": "..."`.

- **Planned → ready:** replace in place.
- **New:** append to the chosen section's `handouts` array.

### 3. Run the Handouts CLI

From the repo root:

```bash
dotnet run --project backend/src/MathComps.Cli.Handouts -- <base>.*.tex
```

Scope the glob to this handout. Always upload (do not pass `--skip-upload`). Exit code 0 = success.

### 4. Handle CLI failures

The CLI exits 1 on compile failures OR unknown commands.

**Compile failures:** stop and surface the failing file(s) to the user. Do not try to fix `.tex` content here and do not quote the TeX log — it's noise. The user will re-enter the `handout-editor` skill (or work with Claude directly) to fix and then re-run this skill.

**Unknown commands:** the CLI prints a `Source File` → `\command` table.

The purpose of `backend/src/MathComps.TexParser/TexCleaner/tex_cleaner_rules.txt` is to **bridge the source world (PlainTeX + AMS-TeX + OPmac, compiled by `pdfcsplain` to PDF) with the web world (KaTeX-rendered math in the site's content JSON)**. Many macros that PlainTeX/OPmac understand do not exist in KaTeX (or mean something different there); the rules file decides how each command crosses that boundary: pass through to KaTeX unchanged (`[leave]`), rewrite to a KaTeX-compatible form (`[substitute]`), or drop entirely because it only affected PDF layout (`[remove]`).

Apply your judgment per row (do not ask), then report one line per decision:

| Situation | Action |
| --- | --- |
| Standard command the source uses and KaTeX also understands (e.g. `\cosh`, `\arctan`, `\mathfrak`) | Add the bare name to `[leave]`. |
| PlainTeX/OPmac/AMS-TeX or project-shorthand macro that doesn't exist in KaTeX but has a canonical KaTeX equivalent reusable across handouts (e.g. `\uhol` → `\angle`, `\Bbb` → `\mathbb`, `\root…\of` → `\sqrt[…]`) | Add a `[substitute]` rule using `PATTERN => REPLACEMENT`. Mirror existing regex style (`(?![A-Za-z])` lookahead). |
| PDF-only layout/spacing command with no meaning on the web (e.g. `\smallskip`, custom `\*skip` variants) | Add to `[remove]`. |
| Typo, one-off non-standard macro, or a case where the source should just use a canonical KaTeX-friendly command directly | Fix the `.tex` file(s). |

Rule of thumb: the macro genuinely bridges source→web and other handouts will hit it too → cleaner rule; idiosyncratic to this one file or simply wrong → fix the handout so the source stays KaTeX-clean.

Re-run the CLI on the same scoped glob until exit 0.

### 5. Validate

```bash
cd web && npm run handouts:validate
```

Must exit 0. Typical failures: missing content file (CLI didn't run for that locale), duplicate slug, orphan file, missing field for a declared language.

### 6. Report

One short summary: entry added/promoted, chosen category, generated JSONs in `web/src/content/handouts/`, uploaded PDFs/images, cleaner-rules changes. Use clickable paths.

---

## Rules

- **Never invent an `id`.** Always `npx nanoid`.
- **Never declare a locale without a `<base>.{locale}.tex` file.**
- **Never touch other handout entries** in `handouts.json` beyond the one being finalized.
- **Never run the CLI with an unscoped glob** unless the user explicitly asks for a full rebuild.
- **Never edit `.tex` content** except to fix a typo/non-canonical command surfaced as unknown.
- **Never commit or push, never configure R2 credentials, never modify `handout-metadata-types.ts` or the validation script.**
- **Before editing the cleaner-rules file**, re-read it to preserve section order, comment style, and regex conventions. Never reorder or dedupe existing entries.
- **Only ask the user when genuinely blocked** — e.g. `.tex` metadata (title/slug/author) disagrees across locales in a way that isn't a translation. Never ask for confirmation of derived values.
