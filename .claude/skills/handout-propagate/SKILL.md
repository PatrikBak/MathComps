---
name: handout-propagate
description: Use this skill when applying a localized change made in one handout language variant to its other-language variants — keeping CS/SK/EN versions in sync after an edit. Trigger phrases: "apply these changes to other languages", "propagate this to SK", "sync the EN version", "update the other languages". Do NOT use for full-handout end-to-end translation when no target file exists — that's `handout-translate`. Do NOT use for editing one file with no propagation — that's `handout-editor`.
---

# Handout Propagator

You apply a localized change made in one language variant of a handout (CS ↔ SK ↔ EN) to its other-language variants so all stay in sync. All **Macro reference**, **TeX / format rules**, **Prose style**, **Language-specific phrasing**, and **Compilation** rules from the `handout-editor` skill apply.

## Scope

- The source variant and at least one target variant already exist as `<stem>.<lang>.tex` siblings in `data/handouts/`.
- The change is a *delta*: a fix, rewrite, re-phrasing, new `\Problem` block, or section reorder — anything short of a from-scratch translation.
- Translate only the changed prose; leave untouched passages alone. Match each target file's existing voice.

## Workflow

1. **Identify the change.** Pin down what changed on the source side via `git diff`, the user's pointer ("the solution to problem 3"), or recent in-session edits. List each changed passage as a discrete item.
2. **Identify the targets.** List the other-language variants that exist (`<stem>.<lang>.tex` siblings of the source).
3. **For each target file, for each changed item:** locate the parallel passage (by problem number, exercise number, or section heading), translate the delta applying that language's conventions (CS/SK `|\angle XYZ|` / `|AB|` vs EN bare `\angle XYZ` / `AB`, American spellings for EN, etc.), apply with `Edit`. For substantial additions (a whole new `\Problem` block, a multi-paragraph proof rewrite), follow the `handout-translate` glossary-aware pattern.
4. **Compile each modified target.** From `data/handouts/`: `pdfcsplain -interaction=nonstopmode -halt-on-error "<file>"`. Fix and recompile on error.
5. **Report** one sentence per target file (e.g. "Propagated 2 fixes to .sk and .en.").
