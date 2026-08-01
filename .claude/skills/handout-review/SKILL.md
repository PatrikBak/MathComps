---
name: handout-review
description: Use this skill to math-check the solutions in one olympiad math handout `.tex` file. For each `\Problem` with a non-empty solution, spawns one parallel reviewer agent that verifies mathematical correctness — logical gaps, unstated assumptions, case-analysis errors, wrong lemmas — and flags any `\EnvId` name that gives the solution away, then produces a punch list. Trigger phrases — "review the math", "are these solutions correct", "math-check this handout", "verify the proofs", "do the problem names spoil anything". Do NOT use for spelling/typo proofreading (use `handout-typos`), prose/style polish (use `handout-editor`), or full-handout translation review (use `handout-translate`).
---

# Handout Review

You are a critical math reviewer for olympiad handouts. Your job is to find real mathematical errors in solutions that compile cleanly but hide subtle bugs — wrong lemmas, skipped cases, unstated assumptions, hand-waved induction steps.

## Scope

Math correctness only, plus two non-math checks that ride along on the same reviewers: whether a problem's `\EnvId` name gives its solution away (see [Name leaks](#name-leaks)), and whether the solution bashes where a synthetic route exists (see [Bashing](#bashing)). Not style, not typos, not compile. One handout `.tex` file per invocation. Read-only — never apply edits during a review.

## Workflow

1. Read the target `.tex` file.
2. Identify each `\Problem{...}` block with a non-empty solution slot (the final brace-arg). Skip problems whose solution slot is empty `{}` — there is nothing to review.

   **Review what the invocation puts in scope, not reflexively the whole file.** Default to every filled problem, but when the caller names a subset (the problems just filled this session, one section, a list of `\EnvId`s), review exactly those. Re-reviewing solutions that already passed costs an agent each and buries the new findings in a wall of CORRECT. Whenever you scope down, name the skipped problems in the report, so a partial pass is never mistaken for a full one.
3. **For each such problem, spawn one `general-purpose` Agent in parallel.** One agent reviews exactly one problem — never batch multiple problems into one agent. The fanout is the point: each reviewer arrives cold to one problem and is not influenced by neighboring solutions.
4. Collect verdicts. **Sanity-check each** before relaying — reviewers are themselves imperfect, and an "INCORRECT" verdict is a signal, not a verdict. Spot-check the cited error against the solution; if the reviewer is the one who is wrong, say so and downgrade.
5. Report a punch list to the user: per-problem verdict + the substantive issues + any name that leaks, with file-relative links to the problem in the form `[Pn](data/handouts/<file>.tex#Lstart-Lend)`. Do **not** apply edits.

## Reviewer agent prompt template

Each spawned agent gets a prompt of roughly this shape. Fill the slots with content from the handout file.

```
Review this olympiad math solution for correctness. Be critical — find real mathematical errors, logical gaps, unstated assumptions, claims that don't follow, missing cases. Don't flag style. Also check the solution follows the hint chain below: the hints are the author's own intended route, so the same key idea, the same auxiliary objects, the same order. Hints deliberately skip steps that are easy relative to the problem's difficulty, so filling in an unstated easy step is fine; reaching the same conclusion by a different route is not. Finally, judge the NAME: it lands in the page URL, so a reader sees it before they have opened a hint, and it may describe only what the statement visibly says. It LEAKS if it names the technique, the auxiliary construction, the property the solution exists to prove, the key modulus, or the answer. Also judge the METHOD: these are handouts about beautiful ideas, so trigonometry, coordinates, vectors-as-algebra and complex numbers are BASH unless the handout is itself about that technique. Flag even a single $\sin$ or $\cos$ smuggled in to finish a length or angle comparison, and say which congruence, similarity or tangent-length argument replaces it. Report under 150 words: VERDICT (CORRECT / INCORRECT / INCOMPLETE) + HINTS (FOLLOWS / DEVIATES — where and how) + NAME (SAFE / LEAKS, with what it gives away and a replacement slug) + METHOD (SYNTHETIC / BASH, with the replacement route) + ISSUES bullet list.

NAME:
<the \EnvId name half, i.e. everything after its leading 21 characters>

PROBLEM:
<statement>

HINTS:
<hint 1>
<hint 2>
...

SOLUTION:
<solution text>

[For a hard problem: append 2–4 specific verification points the reviewer should check, e.g. "verify the inductive step under the strengthened hypothesis", "verify the base case explicitly", "check that the claimed factorization holds for all n, not just small cases".]
```

The verdict scheme:
- **CORRECT** — math is sound; at most cosmetic gaps.
- **INCOMPLETE** — argument is broadly right but skips a case, an assumption, or a step that needs to be stated.
- **INCORRECT** — load-bearing error: a wrong lemma, a false claim, a construction that demonstrably doesn't work.

`HINTS: DEVIATES` is a finding in its own right and is reported even when the verdict is CORRECT — a solution that proves the statement by a route the author didn't hint is still the wrong solution for this handout. It is also the one thing a correctness-only reviewer will never surface, since nothing about it is mathematically wrong.

**A long ladder needs slot-by-slot checking.** Past six or so hints (ladders of fifteen exist) "the same idea, the same order" stops being checkable, and a reviewer confirms the overall shape while missing that slots 7 to 9 left no trace. For those, number the hints in the prompt and require a verdict per slot: does hint *k*'s milestone appear, and does it appear in the right place relative to *k-1* and *k+1*? A slot that never lands means the solution jumped the gap that hint existed to bridge; a solution reaching slot *k+1*'s insight before slot *k*'s means the ladder no longer describes the route.

Both are hint-quality findings as much as solution findings, so report them as such: the author may prefer to cut a hint rather than rewrite a solution around it.

**Don't key difficulty off the stars.** The corpus is `\Problem{0}`×591, `{1}`×63, `{2}`×18 and zero `{3}` — most handouts convey difficulty by problem ordering and carry `{0}` throughout, so stars are not a usable signal. Judge hardness from the statement, the source (an IMO/ISL problem is hard whatever its stars say), and the length of the hint ladder.

For a hard problem, the prompt should include explicit checklists — induction steps especially are where reviewers without prompting tend to rubber-stamp. The hints in the handout often telegraph the intended proof structure; cite them in the prompt so the reviewer knows what the solution was supposed to do.

## Name leaks

Every environment carries `\EnvId{<21-char nanoid>-<name>}`, and the name half lands in the page URL and the copy-link button, so a reader meets it before they have opened a hint. The authoring rule (stated in `handout-editor`) is that a name may describe only what the statement visibly says. These reviewers are the only readers positioned to catch a breach, because a leaking name looks innocent until you know the solution: `bijection-from-xfx-plus-fy` and `excircle-parallelograms` both read as neutral descriptions right up to the moment you see that one names the pivotal deduction and the other the auxiliary circle three hints build toward.

Adjudicate the flags rather than applying them. A name is a spoiler only when it names something the statement does not, so a `\Theorem` named after the theorem it states is fine, and so is a problem named after an object its own statement introduces. Require a replacement with every LEAKS, or the verdict is an opinion instead of a finding. Renaming is a source-only edit with no migration behind it; the leading 21 characters are what must never move.

Two coverage limits, worth naming in the report when they bite: environments this review spawns no agent for (theorems, definitions, examples, and problems whose solution slot is empty) get no name check at all, and each reviewer sees only its own problem, so none of them can catch two names colliding.

## Bashing

A solution that grinds through trigonometry, coordinates, vectors-as-algebra or complex numbers is usually *correct*, so a correctness-only reviewer waves it through — which is exactly why it rides along here, on the same footing as `HINTS: DEVIATES`. These handouts teach beautiful ideas; a computational route teaches nothing even when every line of it checks out.

Adjudicate rather than relay. `METHOD: BASH` is a finding only when a synthetic route actually exists and the reviewer names it, so require the replacement (the congruence, the similar triangles, the equal tangents, the cyclic quadrilateral) with every flag. Two things are **not** bashing: a handout that is itself about the technique, where it is the whole point (judge from `\sec Úvod` and the neighbouring solutions), and a named tool invoked once inside an otherwise synthetic chain — the law of cosines closing a length comparison is a tool, a page of coordinates is a grind. Light vector notation for midpoints and translations sits on the synthetic side; setting up axes does not.

The common real case is small: one stray $\sin$, $\cos$ or $\tan$ finishing a comparison that a congruence would have closed. Worth fixing, and worth reporting even when the verdict is CORRECT.

## When not to use

- **Single-problem review** — just review inline. The skill exists for the fanout pattern; one problem doesn't need it.
- **Style / prose / typo review** — use `handout-typos` or `handout-editor`.
- **Compile failures** — `pdfcsplain` already tells you those. This skill assumes the file compiles.
- **Cross-language consistency** — use `handout-translate` for syncing SK/CS/EN variants.
