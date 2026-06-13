---
name: handout-typos
description: Use this skill to proofread a handout .tex file for serious objective errors only — misspellings, missing/wrong diacritics, broken agreement, missing words, repeated words, clear punctuation mistakes. Applies confident fixes directly and flags the rare genuinely ungrammatical sentence for user review. Trigger words: "proofread", "typo pass", "find typos", "spell check", "grammar check" on a handout. Languages: CS, SK, EN. Do NOT use for rephrasing, style polish, awkward-phrasing rewrites, or translation — use the `handout-editor` skill for that.
---

# Handout Typo & Grammar Fixer

You proofread one olympiad math handout `.tex` file (PlainTeX + AMS-TeX + OPmac) for **serious objective errors only** — the kind a native speaker would instantly recognize as a mistake. Apply confident fixes directly with Edit. Everything else stays untouched.

**Hard rule: never change the author's style or identity.** Word choice, sentence rhythm, idiom, level of formality, signature turns of phrase — all off-limits. You are fixing *mistakes*, not editing *writing*. When you can hear the author in a sentence, leave it alone even if you would phrase it differently.

**Higher-order hard rule: math writing is allowed to sound a bit stiff, a bit clunky, or a bit unpolished.** That is not a mistake. A sentence that is slightly awkward, a word choice that isn't the most natural, a construction that a copy editor would smooth out — all of that is fine and must be left alone. Only fix what a competent native speaker would read and say "that's wrong," not "I'd phrase it differently."

---

## Scope

- **Operate on one `.tex` file at a time** in `data/handouts/`. If the user names several, process them one by one.
- **Edit prose only.** Math, macro names, commands, labels, URLs, and verbatim content are off-limits.
- **Language** is set by `\setlanguage{CS|SK|EN}` in the file (and mirrored in the filename suffix `.cs.tex` / `.sk.tex` / `.en.tex`). Apply CS/SK/EN rules accordingly.
- **Two input shapes.** Default is one whole file. If the user asks to check only recent changes (a diff), identify the changed passages via `git diff` or recent in-session edits — and operate on those passages **plus their surrounding sentence or paragraph**, since agreement, case, and punctuation errors need context to detect. Passes 1–2 run over that scope, not the whole file.

---

## Workflow

1. **Identify the target file.** If the user hasn't named one: prefer the handout created or edited in the current session (e.g. the output of a just-finished translate/edit pass) and say so. Otherwise check `git status` — when exactly one handout `.tex` is modified or added, take it as the target and say so. Otherwise ask.
2. **Read** the file and note the language.
3. **Pass 1 — collect candidates** across prose only. Sweep the **High-frequency pitfalls** list below explicitly — those errors parse fine and slip past a prose read. Include only *serious*, *objective* errors:
   - **Misspellings** and missing/wrong diacritics.
   - **Broken agreement** (gender/number/case), clearly wrong verb forms, a missing or doubled word that breaks the sentence.
   - **Unequivocal punctuation mistakes** that change parsing or are clearly wrong (not stylistic comma choices).
   - **Casing errors:** sentence-initial uppercase; proper names capitalized. Don't over-capitalize — in CS/SK, days, months, and language names stay lowercase unless sentence-initial.
   - **Repeated words** (case-insensitive): immediate duplicates separated only by whitespace, `~`, or trivial punctuation (`token token → token`).
   - **Genuinely ungrammatical sentences** — word salad, missing essential particle, mangled construction that no native speaker would produce. Merely awkward, stiff, clunky, or non-idiomatic phrasing does **not** qualify. If a native speaker could read the sentence and say "that's an unusual way to put it, but it's fine," it stays.
4. **Pass 2 — classify each candidate** into one of three buckets:
   - **Fix directly**: objective mistake (typo, diacritic, agreement error, obvious duplicate word, sentence-initial case) where the correction is unambiguous and cosmetic.
   - **Uncertain**: proper noun you can't verify, a clearly ungrammatical sentence where the minimal fix is non-obvious, or a spelling/case-ending choice that hinges on meaning you can't infer. Be stingy with this list — if you're about to flag something because it "could be smoother," drop it.
   - **Leave alone**: author's voice / idiom / rhythm / clunkiness — not a mistake, just not how you'd write it. This is the default; when in doubt, here.
5. **Apply the "fix directly" items with Edit.** One fix per Edit call; include 2–3 words of surrounding context so `old_string` is unique. Use `replace_all` only when the replacement is safe in every occurrence. Batch independent Edit calls in a single message.
6. **Report and resolve Uncertain.** Start with a one-sentence summary of directly-applied fixes (e.g. "Fixed 3 diacritics, 1 repeated word, 1 agreement."). If nothing is Uncertain, say so in a few words and stop.

   Otherwise, for each Uncertain item print a short paragraph with: a line-number anchor (e.g. `L296`), the problematic clause with surrounding context, a minimal proposed fix, and a few-word reason (e.g. "missing verb", "wrong case ending", "doubled preposition"). Deduplicate — each distinct item once.

   Then call `AskUserQuestion` (batched up to 4 per call) with options per item: **Apply suggested fix** / **Leave alone**. Apply approved fixes via Edit and emit a final one-liner with what was applied. If you genuinely have no idea what the author meant for an item, leave it out of `AskUserQuestion` and ask in plain text instead.
7. **No fan-out — proofread in the main session**, even for long handouts (the longest are ~850 lines, well within one context). Whole-file context is part of the detection toolkit (consistency evidence, referent tracking), and slice-based subagent proofreading has shown near-zero recall on real inflection errors while producing exactly the style false positives this skill forbids. On long multi-problem handouts, keep attention sharp by running pass 1 as sequential chunks — one `\Problem` block (or ~150-line window) at a time — instead of one continuous skim.

Do not compile. Typo fixes in prose cannot break TeX. If the user wants a compile check afterwards, they will ask.

---

## Ignore zones (never inspect or edit)

- **Comments:** from an **unescaped** `%` to end of line; lines starting with `%`; `\iffalse … \fi`; `\begin{comment} … \end{comment}`.
- **Math:** `$…$`, `\(…\)`, `$$…$$`, `\[…\]`, and math envs (`equation`, `align`, `eqalign`, `cases`, `gather`, `matrix`, `pmatrix`, …).
- **Verbatim / code:** `verbatim`, `lstlisting`, `minted`, `alltt`, `\verb|…|`.
- **Control / IDs:** any token starting with `\`; contents of `\label{}`, `\ref{}`, `\cite{}`, `\url{}`, `\href{}`, `\path{}`, `\MathcompsLink{}`, `\setlanguage{}`, `\input`, filename-like arguments.

### Allowed prose wrappers (check **inside** the braces only)

- In math: `\text{…}`, `\hbox{…}`, `\mbox{…}`.
- In text: `\textit{…}`, `\textbf{…}`, `\emph{…}`, `\textrm{…}`, `\textsf{…}`.

Never alter the macro name or its options — only the prose inside.

---

## TeX spaces

`~` is a non-breaking space. Treat it as a normal space for tokenization and repeated-word detection (e.g. `k~nájdenému`). **Never** remove, insert, or flag `~` itself.

---

## High-frequency pitfalls (sweep explicitly)

These errors leave the sentence parsing fine, so a prose read glides over them — check occurrences deliberately:

- **SK singular inštrumentál needs `í`:** `svojím ťahom`, `ním`, `tvojím`; the short forms `svojim`/`nim` are plural datives.
- **Inanimate math nouns decline inanimately:** SK `v čitateli`, `v menovateli` — `čitateľovi` is the animate form (a reader, not a numerator). CS: `v čitateli`, `ve jmenovateli`.
- **CS classics:** `mně`/`mě`, `ji`/`jí`, `by jsme` → `bychom`, `aby jste` → `abyste`.
- **Contaminated or incomplete constructions:** crosses like `vyzerá byť, že` (mix of `vyzerá byť X` and `vyzerá, že`); clefts missing their verb (`Posledné, čo zostáva rozmyslieť, je, ako…`).
- **Referent slips:** the same role-noun twice in one clause where the second should be the other actor (`každý ťah hráča vedie do vyhrávajúcej pozície hráča` → `súpera`). When a player/opponent noun repeats, check who is actually meant. Meaning-dependent → Uncertain, not a direct fix.
- **Consistency evidence:** before fixing an inflection, search the file for other occurrences — a correctly inflected form elsewhere in the same handout confirms both the slip and the fix.

---

## Confidence bar for direct fixes

Apply directly only when the correction is unambiguous, local, and cosmetic. Move to **Uncertain** (or leave alone entirely) when any of the following apply:

- The original could be a valid but unusual form.
- It is a proper noun whose correct form you cannot verify.
- The choice depends on meaning (e.g. CS/SK `i` vs `í`, `s` vs `z`, SK `mi` vs `my`) and context is thin.
- A punctuation change could alter meaning or emphasis.
- The token is domain jargon you don't confidently know (mathematical terms in CS/SK: check twice before "fixing").
- **The fix would rewrite a phrase rather than correct a token.** Don't. Not directly, not in Uncertain — leave it alone.
- **The phrasing is merely clunky, stiff, or unpolished, not ungrammatical.** Leave it alone. Math writing is allowed to be plain, even slightly awkward. A sentence that parses and means what it should is not a mistake.

When in doubt: leave unchanged, and do **not** list under Uncertain.

### What counts as "style" (never touch, never flag)

- Choice of connective (`teda` vs `preto`, `tedy` vs `proto`, `thus` vs `so`).
- Sentence length, comma-splice-ish rhythm the author uses consistently.
- Favorite hedges, interjections, or signature phrasings ("Všimnime si", "Zrejme", "Note that", "Clearly").
- Level of formality, first-person plural vs passive, active vs passive voice.
- Word order that parses, even if you'd reorder it.
- Non-idiomatic but grammatical word choices — e.g. a slightly unusual adjective, a translated-feeling turn of phrase that still parses.
- Stiffness, stuffiness, repetition, or a sentence that could be "smoother."

If in doubt whether something is a mistake or a voice choice, it's voice. Leave it. The bar for flagging anything at all is: *a native speaker would read this and say it's wrong*, not *a native speaker could improve it*.