---
name: handout-translate
description: Use this skill to make a target-language variant of a handout consistent with the source — whether the target file doesn't exist yet (translate end-to-end) or already exists and just needs the latest changes synced (propagate delta). Operates on the PlainTeX+AMS-TeX+OPmac stack used by this project, CS / SK / EN. Trigger phrases: "translate this handout to SK", "preložte do češtiny", "translate the EN version", "propagate this to SK", "sync the EN version", "apply these changes to other languages", "ensure this is in CS too", "update the other languages". Do NOT use for editing a single language variant in place (use `handout-editor`).
---

# Handout Translator

You make a target-language variant of an olympiad math handout (CS ↔ SK ↔ EN) consistent with its source. All **Macro reference**, **TeX / format rules**, **Prose style**, **Language-specific phrasing**, and **Compilation** rules from the `handout-editor` skill apply — read those sections before starting. This skill adds only the translation/propagation workflow.

## Mode selection

Pick the mode by checking the target file first, then the user's pointer:

- If the user pointed at a specific change, region, or `git diff` to sync, **and** the target file exists → **Workflow B (propagate delta)**, regardless of how the user phrased it.
- Else if the target file does **not** exist → **Workflow A (translate from scratch)**.
- Else (target exists, no specific change pointed at) → **ask** the user: "Target file exists. Sync recent changes from source, or replace with a fresh translation?" Default the choice toward sync — re-translating an existing variant is rare and destructive.

## Workflow A — translate from scratch

Scope:

- One source `.tex` file → one target `.tex` file in `data/handouts/`. Keep the source filename stem; change only the language suffix (e.g., `factorization.en.tex` → `factorization.sk.tex`).
- Translate **all prose**: statements, solutions, `\Answer` results, section headings, footnotes, intro text.
- Keep all math, macro names, and structure identical.
- **`\EnvId{<nanoid>-<name>}` has a half that travels and a half that gets translated.** The leading 21 characters are the permanent id, shared across every language variant on purpose — a saved AI-examiner defense conversation is keyed on it. Copy those 21 characters verbatim, in the same position; never invent, drop, or reorder an id. Everything after them is the environment's name in that file's language, which lands in the page URL: write the target language's own name for it, don't carry the source language's across. Name it from what the statement visibly says, never from the technique, the key modulus, or the answer.
- Set the correct `\setlanguage{...}` and `\MathcompsLink{...}` slug.
- Match the target language's label conventions used in existing handouts.

Steps:

1. **Identify source, target, and `\MathcompsLink` slug.** Confirm source file and target language with the user if not specified. Then find the handout entry in `web/src/content/handouts.json` (whose `slug.<source-lang>` matches the source's slug) and check `slug.<target-lang>`: if populated, that's the `\MathcompsLink{...}` value to use; if missing (or the handout isn't registered in `handouts.json` yet — drafts aren't), translate the title into the target language and derive a kebab-case slug from it; when that slug comes out identical to the source's, use it without asking, otherwise confirm it with the user before proceeding. Note that slugs are translated, not transliterated (e.g. `factorization` ↔ `rozklady-na-soucin` ↔ `rozklady-na-sucin`).
2. **Lock terminology — cross-check, then ask; never assume specialized terms.** Read the full source and list the technical terms, named-object conventions, and signature phrases. For each, first grep the project's existing hand-written target-language handouts (`data/handouts/*.<targetlang>.tex`) and reuse the attested rendering. For any *advanced* term with no attestation — the real failure mode when translating INTO SK/CS, where machine translation reliably produces non-native terms (a modular *inverse* is `inverz`, not `inverzia`/`inverze`; semiperimeter is `polovica`/`polovina obvodu`, not `poloobvod`; see the `handout-sk-cs-math-terms` memory) — batch the unresolved terms and **ask the user before fanning out, rather than guessing a rendering**. (EN target: you are the authority, no ask needed.) Also note the CS/SK `|\angle XYZ|` / `|AB|` bar conventions vs EN bare `\angle XYZ` / `AB`, and American spellings for EN.
3. **Fan out the translation.** Dispatch 3–5 parallel subagents over contiguous, non-overlapping slices of problems/sections. Each agent receives: the glossary, its source slice, and the target-language conventions. Trust your judgment to skip fan-out on trivially small inputs.
4. **Assemble** the merged target file with `\setlanguage{...}` and the right `\MathcompsLink{...}` slug.
5. **Consistency sweep.** Read the merged file top-to-bottom once. Verify each glossary term renders identically across slices, smooth obvious voice/register inconsistencies at slice boundaries, catch any untranslated fragments (forgotten source-language tokens, mismatched conventions), and flag sentences that read as transliterated rather than native — rephrase rather than letting them survive the sweep. Apply fixes via Edit.
6. **Compile and verify.** From `data/handouts/`: `pdfcsplain -interaction=nonstopmode -halt-on-error "<file>"`. Fix any error and recompile.
7. **Report** in one sentence.

## Workflow B — propagate delta

Scope:

- The source variant and at least one target variant already exist as `<stem>.<lang>.tex` siblings in `data/handouts/`.
- The change is a *delta*: a fix, rewrite, re-phrasing, new `\Problem` block, or section reorder — anything short of a from-scratch translation.
- Translate only the changed prose; leave untouched passages alone. Match each target file's existing voice.

Steps:

1. **Identify the change.** Pin down what changed on the source side via `git diff`, the user's pointer ("the solution to problem 3"), or recent in-session edits. List each changed passage as a discrete item.
2. **Identify the targets.** List the other-language variants that exist (`<stem>.<lang>.tex` siblings of the source).
3. **For each target file, for each changed item:** locate the parallel passage (by problem number, exercise number, or section heading), translate the delta applying that language's conventions (CS/SK `|\angle XYZ|` / `|AB|` vs EN bare `\angle XYZ` / `AB`, American spellings for EN, etc.), apply with `Edit`. When the source uses a construction without a clean target-language analogue (compact noun forms like SK `n-číslie`, idiomatic particles, telegraphic nominalizations), rephrase rather than transliterate — a parsable sentence isn't the same as one a native would write. For substantial additions (a whole new `\Problem` block, a multi-paragraph proof rewrite), switch to Workflow A's glossary-aware translation pattern for that region.
   - **A brand-new environment** (one the target doesn't have yet) already carries its `\EnvId` on the source side — it was written directly when the environment was authored. Copy that exact id into the target and give it the target language's own name; never mint a fresh id here. A new environment on the source with no `\EnvId` above it is a bug in the source, not something to work around: stop and flag it (or add the id to the source yourself) rather than inventing an id for the target that the source doesn't share — that silently creates two different ids for what should be one environment.
   - **An existing environment's id** never changes — copy those 21 characters exactly, never re-mint or drop them, even when reformatting the block around it. Its name may be reworded freely; only keep it unique within the file.
4. **Compile each modified target.** From `data/handouts/`: `pdfcsplain -interaction=nonstopmode -halt-on-error "<file>"`. Fix and recompile on error.
5. **Report** one sentence per target file (e.g. "Propagated 2 fixes to .sk and .en.").
