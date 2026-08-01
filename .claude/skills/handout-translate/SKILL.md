---
name: handout-translate
description: Use this skill to make a target-language variant of a handout consistent with the source — whether the target file doesn't exist yet (translate end-to-end) or already exists and just needs the latest changes synced (propagate delta). Operates on the PlainTeX+AMS-TeX+OPmac stack used by this project, CS / SK / EN. Trigger phrases — "translate this handout to SK", "preložte do češtiny", "translate the EN version", "propagate this to SK", "sync the EN version", "apply these changes to other languages", "ensure this is in CS too", "update the other languages". Do NOT use for editing a single language variant in place (use `handout-editor`).
---

# Handout Translator

You make a target-language variant of an olympiad math handout (CS ↔ SK ↔ EN) consistent with its source. All **Macro reference**, **TeX / format rules**, **Prose style**, **Language-specific phrasing**, and **Compilation** rules from the `handout-editor` skill apply — read those sections before starting. This skill adds only the translation/propagation workflow.

## Before you start: translate a verified source

If the source's solutions or proofs were written or rewritten recently and have not been through `handout-review`, run that first and let its fixes land. A faithfully translated error passes both later audits clean (each checks the target against the source), so it lands in every target and costs one correction per language. Freshly authored content only — an already-reviewed source needs no re-check.

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
2. **Lock terminology — cross-check, then ask; never assume specialized terms.** Read the full source and list the technical terms, named-object conventions, and signature phrases. For each, first grep the project's existing hand-written target-language handouts (`data/handouts/*.<targetlang>.tex`) and reuse the attested rendering. For any *advanced* term with no attestation — the real failure mode when translating INTO SK/CS, where machine translation reliably produces non-native terms (a modular *inverse* is `inverz`, not `inverzia`/`inverze`; semiperimeter is `polovica`/`polovina obvodu`, not `poloobvod`) — batch the unresolved terms and **ask the user before fanning out, rather than guessing a rendering**. (EN target: you are the authority, no ask needed.) Also note the CS/SK `|\angle XYZ|` / `|AB|` bar conventions vs EN bare `\angle XYZ` / `AB`, and American spellings for EN.

   Two rules about the glossary you hand the agents, both learned the hard way:

   - **Exactly one rendering per entry. Never write an alternative.** A glossary line reading `označme → denote / write` does not give the agents a choice, it guarantees a split: each slice picks one and the merged file reads as two documents.
   - **The glossary must cover stock discourse phrases, not just technical terms.** Technical vocabulary is what you think to pin down and it is not what drifts; what drifts is the connective tissue every solution repeats. Pin at minimum: the hortative (`Dosaďme` → EN `Let us` vs `Let's` — pick one), `označme`, `voľbou`/`dosadením`, `lebo`/`keďže`, `zostane`/`zostáva`, and the closing `Skúška` sentence.

     Pin the **form of cross-references** too, and pin it as "match the source at each spot". A handout cites its own results both ways — `Tvrdenie 2` in one proof, `podľa vety o dvoch dotyčniciach z bodu` in another — so agents given no rule split down the middle, some resolving the descriptive citations into numbers and some not. Renumbering is worse than a wording drift: the number is correct only until an environment is inserted above it.
3. **Fan out the translation.** Dispatch 3–5 parallel subagents over contiguous, non-overlapping slices of problems/sections. Each agent receives: the glossary, its source slice, and the target-language conventions. Trust your judgment to skip fan-out on trivially small inputs.

   **Tell each agent to author, not to render.** "Produce a faithful sentence-by-sentence translation" is the instruction that manufactures translationese: it optimizes for tracking source clause boundaries, so the target inherits source word order, connectives and sentence splits, and comes out grammatical but foreign. Give the opposite instruction — read the passage for its mathematics and its step order, then look away from it and write that argument the way a native author would write it from scratch. Same math, same steps, same order, same terseness; sentence structure is the target language's business. This matters most when the source is terse.

   To recognize a bad slice when it comes back: [translationese-patterns.md](translationese-patterns.md).
4. **Assemble** the merged target file with `\setlanguage{...}` and the right `\MathcompsLink{...}` slug.
5. **Consistency sweep.** Read the merged file top-to-bottom once. Verify each glossary term renders identically across slices, smooth obvious voice/register inconsistencies at slice boundaries, catch any untranslated fragments (forgotten source-language tokens, mismatched conventions), and flag sentences that read as transliterated rather than native — rephrase rather than letting them survive the sweep. Apply fixes via Edit.

   Reading alone does not catch drift: two renderings of the same phrase are each fine in isolation and only wrong together, which is exactly what a linear read misses. So **grep for the competing renderings too**, and check where the hits fall. A term that appears only in slices 1-3 and its synonym only in slices 4-5 is drift, not style; a split that tracks hint-vs-solution or statement-vs-proof usually isn't. Do this for every stock phrase from step 2, and pick the majority rendering when you unify.
6. **Independent loss audit. Never skip this because the earlier checks came back green.** Fan out a second wave of agents, none of which wrote any of the text, over the same slice boundaries. Each gets the source and *every* target at its line range and hunts for one thing: content that went missing, got weakened, or got invented.

   Every gate before this point is structural — `\EnvId`/`\Image` diffs, line-count alignment, math byte-equality, term-drift greps, `pdfcsplain` — and a dropped clause passes all of them. The auditors must be agents that wrote none of the text: one re-checking its own slice shares the misreading that caused the omission.

   How to run it:
   - **One agent per slice, given the source and all targets at once.** The files are line-for-line aligned when the fan-out preserved structure, so a CS/EN disagreement on the same line is itself a signal that one of them lost something. Auditing both targets together is cheaper than two passes and strictly better at spotting this.
   - **Scope it hard, or you get style opinions back.** Tell each agent to report only: dropped clauses/conditions/caveats/cross-references, weakened hedges or emphasis, a hint that steers less than the source hint did, a lost proof step, a used-but-no-longer-introduced object, invented content, and meaning flips (inside/outside, same/opposite, at most/at least, which arc, which half-plane, internal/external bisector). Tell it explicitly to ignore word choice, mathematical correctness, the `|AB|` bar convention, and phrasing that carries the same content.
   - **Point each agent at what its slice is load-bearing on**: a long hint ladder (does slot *k* still carry slot *k*'s steer, without leaking slot *k+1* forward), a parallel hint structure over several solution routes (does item (a) still belong to route (a)), a sign or case analysis, a quoted named lemma, a degenerate-case paragraph at the end of a proof, an `\Answer` that characterizes a locus in two ways.
   - **Require `NO FINDINGS` as an explicit output** and tell agents not to pad. Ask for severity, and for the source fragment next to the target fragment so you can adjudicate without re-reading everything yourself.
   - **Judge every finding yourself before acting.** Auditors over-report meaning flips that are really rephrasings, and under-report voice loss. Fix the real ones with `Edit`; the debatable ones go to the user with both readings.
7. **Native-voice audit, and the readers must not see the source.** Step 6 asks whether the content survived; this asks whether the prose reads as though a native wrote it. Fan out one reader per target language over the finished file, give each only that file, and ask a single question: could a native author of this language have written this from scratch?

   The blindness is the design. A reader holding the source rationalizes every calque, because a calque *is* faithful, just to the wrong thing. Step 6 cannot substitute: on one FE propagation its verifiers returned clean on all 40 problem/language pairs, and blind readers then flagged 67 constructions, most of them on lines that pass had just approved.

   How to run it:
   - **One reader per target language**, split into halves for a long file. State explicitly that there is no source text and they must not go looking for one.
   - **Fence off the settled terminology by listing it**, or the pass spends its output re-litigating the glossary from step 2. Fence off terseness the same way: say the text is deliberately compressed and that terse is not a defect, otherwise you get "add an explanation here" back.
   - **Require line, fragment, why a native notices, and a concrete replacement.** A flag with no replacement is an opinion, not a finding.
   - **Adjudicate before applying.** These readers over-flag frequency patterns ("`that is` appears 16 times") and ordinary mathematical idiom. Fix the false friends, wrong government, dangling modifiers and register breaks; leave the taste.
   - **Re-run once after fixing, and ask the re-reader to audit your fixes, not just the residue.** Say explicitly: flag anything that now reads worse because a correction was applied clumsily — a doubled connective, a broken agreement, a clause that no longer parses, a repeated word. Applying dozens of one-line replacements reliably manufactures a few of these (`Since X, so also Y`, a subject stranded by a rewritten predicate), and the round-one reader never saw them. If the count barely moves, the problem is the authoring instruction in step 3, not the sentences: re-author the region rather than patching further, since patching leaves the source-shaped clause rhythm underneath.
8. **Compile and verify.** From `data/handouts/`: `pdfcsplain -interaction=nonstopmode -halt-on-error "<file>"`. Fix any error and recompile.
9. **Report** in one sentence, plus any finding you could not adjudicate.

## Workflow B — propagate delta

Scope:

- The source variant and at least one target variant already exist as `<stem>.<lang>.tex` siblings in `data/handouts/`.
- The change is a *delta*: a fix, rewrite, re-phrasing, new `\Problem` block, or section reorder — anything short of a from-scratch translation.
- Translate only the changed prose; leave untouched passages alone. Match each target file's existing voice.

Steps:

1. **Identify the change.** Pin down what changed on the source side via `git diff`, the user's pointer ("the solution to problem 3"), or recent in-session edits. List each changed passage as a discrete item.
2. **Identify the targets.** List the other-language variants that exist (`<stem>.<lang>.tex` siblings of the source).
3. **For each target file, for each changed item:** locate the parallel passage (by problem number, exercise number, or section heading), translate the delta applying that language's conventions (CS/SK `|\angle XYZ|` / `|AB|` vs EN bare `\angle XYZ` / `AB`, American spellings for EN, etc.), apply with `Edit`. When the source uses a construction without a clean target-language analogue (compact noun forms like SK `n-číslie`, idiomatic particles, telegraphic nominalizations), rephrase rather than transliterate — a parsable sentence isn't the same as one a native would write. For substantial additions (a whole new `\Problem` block, a multi-paragraph proof rewrite), switch to Workflow A's glossary-aware translation pattern for that region.
   - **A delta that replaces whole solution or proof bodies is not a delta for this purpose.** Once you are rewriting the body rather than patching a clause inside it, hand the region Workflow A step 3's author-don't-render instruction. Propagating a compression pass is the case that bites: the source got terser, so every body changes, and "apply the same cuts, faithfully" is a sentence-tracking instruction wearing a delta's clothes.
   - **A brand-new environment** (one the target doesn't have yet) already carries its `\EnvId` on the source side — it was written directly when the environment was authored. Copy that exact id into the target and give it the target language's own name; never mint a fresh id here. A new environment on the source with no `\EnvId` above it is a bug in the source, not something to work around: stop and flag it (or add the id to the source yourself) rather than inventing an id for the target that the source doesn't share — that silently creates two different ids for what should be one environment.
   - **An existing environment's id** never changes — copy those 21 characters exactly, never re-mint or drop them, even when reformatting the block around it. Its name may be reworded freely; only keep it unique within the file.
4. **Audit any region you fanned out.** A one-sentence fix you applied yourself needs no second reader. But the moment step 3 sent a region to subagents, run Workflow A steps 6 **and** 7 over exactly that region — a delta has no whole-file read to stumble over the gap, so it is worse off than Workflow A, not better. Run 7 even when 6 comes back clean; the two passes fail independently.
5. **Compile each modified target.** From `data/handouts/`: `pdfcsplain -interaction=nonstopmode -halt-on-error "<file>"`. Fix and recompile on error.
6. **Report** one sentence per target file (e.g. "Propagated 2 fixes to .sk and .en.").
