---
name: handout-review
description: Use this skill to math-check the solutions in one olympiad math handout `.tex` file. For each `\Problem` with a non-empty solution, spawns one parallel reviewer agent that verifies mathematical correctness — logical gaps, unstated assumptions, case-analysis errors, wrong lemmas — and produces a punch list. Trigger phrases: "review the math", "are these solutions correct", "math-check this handout", "verify the proofs". Do NOT use for spelling/typo proofreading (use `handout-typos`), prose/style polish (use `handout-editor`), or full-handout translation review (use `handout-translate`).
---

# Handout Review

You are a critical math reviewer for olympiad handouts. Your job is to find real mathematical errors in solutions that compile cleanly but hide subtle bugs — wrong lemmas, skipped cases, unstated assumptions, hand-waved induction steps. Compile success is not what you are checking; the math is.

## Scope

Math correctness only. Not style, not typos, not compile. One handout `.tex` file per invocation. Read-only — never apply edits during a review.

## Workflow

1. Read the target `.tex` file.
2. Identify each `\Problem{...}` block with a non-empty solution slot (the final brace-arg). Skip problems whose solution slot is empty `{}` — there is nothing to review.
3. **For each such problem, spawn one `general-purpose` Agent in parallel.** One agent reviews exactly one problem — never batch multiple problems into one agent. The fanout is the point: each reviewer arrives cold to one problem and is not influenced by neighboring solutions.
4. Collect verdicts. **Sanity-check each** before relaying — reviewers are themselves imperfect, and an "INCORRECT" verdict is a signal, not a verdict. Spot-check the cited error against the solution; if the reviewer is the one who is wrong, say so and downgrade.
5. Report a punch list to the user: per-problem verdict + the substantive issues, with file-relative links to the problem in the form `[Pn](data/handouts/<file>.tex#Lstart-Lend)`. Do **not** apply edits.

## Reviewer agent prompt template

Each spawned agent gets a prompt of roughly this shape. Fill the slots with content from the handout file.

```
Review this olympiad math solution for correctness. Be critical — find real mathematical errors, logical gaps, unstated assumptions, claims that don't follow, missing cases. Don't flag style. Report under 150 words: VERDICT (CORRECT / INCORRECT / INCOMPLETE) + ISSUES bullet list.

PROBLEM:
<statement>

HINTS:
<hint 1>
<hint 2>
...

SOLUTION:
<solution text>

[For \Problem{2} or \Problem{3}: append 2–4 specific verification points the reviewer should check, e.g. "verify the inductive step under the strengthened hypothesis", "verify the base case explicitly", "check that the claimed factorization holds for all n, not just small cases".]
```

The verdict scheme:
- **CORRECT** — math is sound; at most cosmetic gaps.
- **INCOMPLETE** — argument is broadly right but skips a case, an assumption, or a step that needs to be stated.
- **INCORRECT** — load-bearing error: a wrong lemma, a false claim, a construction that demonstrably doesn't work.

For hard problems (`\Problem{2}` / `\Problem{3}`), the prompt should include explicit checklists — induction steps especially are where reviewers without prompting tend to rubber-stamp. The hints in the handout often telegraph the intended proof structure; cite them in the prompt so the reviewer knows what the solution was supposed to do.

## When not to use

- **Single-problem review** — just review inline. The skill exists for the fanout pattern; one problem doesn't need it.
- **Style / prose / typo review** — use `handout-typos` or `handout-editor`.
- **Compile failures** — `pdfcsplain` already tells you those. This skill assumes the file compiles.
- **Cross-language consistency** — use `handout-translate` for syncing SK/CS/EN variants.
