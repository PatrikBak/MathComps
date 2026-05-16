---
name: handout-translate
description: Use this skill when translating an olympiad math handout end-to-end between CS / SK / EN — producing a NEW target-language file from a finished source. Trigger phrases: "translate this handout to SK", "preložte do češtiny", "translate the EN version". Operates on the PlainTeX+AMS-TeX+OPmac stack. Do NOT use for editing one file (use `handout-editor`) or for syncing a small change across already-existing language variants (use `handout-propagate`).
---

# Handout Translator

You translate a finished olympiad math handout from one language to another (CS ↔ SK ↔ EN). All **Macro reference**, **TeX / format rules**, **Prose style**, and **Language-specific phrasing** rules from the `handout-editor` skill apply — read those sections before starting. This skill adds only the translation-specific workflow.

## Scope

- One source `.tex` file → one target `.tex` file in `data/handouts/`. Keep the source filename stem; change only the language suffix (e.g., `factorization.en.tex` → `factorization.sk.tex`).
- Translate **all prose**: statements, solutions, section headings, footnotes, intro text.
- Keep all math, macro names, and structure identical.
- Set the correct `\setlanguage{...}` and `\MathcompsLink{...}` slug.
- Match the target language's label conventions used in existing handouts.

## Workflow

1. **Identify source, target, and `\MathcompsLink` slug.** Confirm source file and target language with the user if not specified. Then find the handout entry in `web/src/content/handouts.json` (whose `slug.<source-lang>` matches the source's slug) and check `slug.<target-lang>`: if populated, that's the `\MathcompsLink{...}` value to use; if missing, translate the title into the target language, propose a kebab-case slug, and confirm with the user before proceeding. Note that slugs are translated, not transliterated (e.g. `factorization` ↔ `rozklady-na-soucin` ↔ `rozklady-na-sucin`).
2. **Lock terminology inline.** Read the full source. Build a small glossary: recurring technical terms, named-object conventions, signature phrases — and pick the target-language rendering for each now. Note CS/SK `|\angle XYZ|` and `|AB|` conventions vs EN bare `\angle XYZ` / `AB` and American spellings.
3. **Fan out the translation.** Dispatch 3–5 parallel subagents over contiguous, non-overlapping slices of problems/sections. Each agent receives: the glossary, its source slice, and the target-language conventions. Trust your judgment to skip fan-out on trivially small inputs.
4. **Assemble** the merged target file with `\setlanguage{...}` and the right `\MathcompsLink{...}` slug.
5. **Consistency sweep.** Read the merged file top-to-bottom once. Verify each glossary term renders identically across slices, smooth obvious voice/register inconsistencies at slice boundaries, catch any untranslated fragments (forgotten source-language tokens, mismatched conventions). Apply fixes via Edit.
6. **Compile and verify.** From `data/handouts/`: `pdfcsplain -interaction=nonstopmode -halt-on-error "<file>"`. Fix any error and recompile.
7. **Report** in one sentence.
