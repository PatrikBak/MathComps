---
name: handout-editor
description: Use this skill when editing one olympiad math handout file — filling solutions, reformatting/transcribing, adding problems, or polishing prose. Operates on the PlainTeX+AMS-TeX+OPmac stack used by this project. Do NOT use for translating or propagating changes between CS/SK/EN language variants (use `handout-translate`).
---

# Handout Editor

## Scope

**Edit `.tex` files only.** The generated JSON is `web/src/content/handouts/*.json` and `handout-env-index.json`: never read, edit, or reference those. `web/src/content/handouts.json` is the opposite, a hand-maintained manifest that no CLI writes; it is owned by `handout-finalize` (and read by `handout-translate` for slugs), so leave it alone here rather than treating it as off-limits generated output.

## Workflow

1. If the user hasn't specified what to do, ask. Common modes: fill solutions, reformat/transcribe, add new problems.
2. Read the relevant `.tex` file(s) with the Read tool if working on an existing file. If the user pastes content inline, work from that directly.
3. Make the requested changes.
4. After every edit, compile and verify. If compilation fails with exit code ≠ 0, fix the error and recompile.
5. If the work involved **writing** new solutions (vs. reformatting, transcribing, or filling in prose the user supplied), invoke the `handout-review` skill before reporting done. Compile catches TeX errors, not math errors — a wrong lemma or skipped sub-case will sail through `pdfcsplain` cleanly.
6. Report what changed (one sentence).

## Filling solutions from hints

Default to a parallel fan-out, one agent per problem. Do not wait to be told the task is parallel.

1. **Triage every problem yourself, up front, in one pass.** Work each solution out from its hints. This is the one place derivation belongs, and it doubles as the agent brief — never grind it again later. Sort into *(a) the hints lead to the intended solution* and *(b) a hint is wrong, ambiguous, or doesn't get there*.
2. **Batch every (b) into a single message and ask.** A hint a competent solver can't follow is a broken hint and the author needs to know — guiding to the solution is the entire point of a hint. Raise mistakes you find in a statement or a stated answer the same way. Never one problem per turn.
3. **Fan out.** Give each agent the `\Problem` block verbatim, your verified route, the prose rules, and the register you established for this handout (see *Calibrate to the handout's own reader* — pick the voice reference to match it; `factorization.sk.tex` is the beginner end of the range, not the default). Agents write prose and TeX; they do not discover.
4. **Bind each agent to the hints, in its prompt.** Same substitutions, same key lemma, same order of discovery: no slicker route, no skipping a step because "it follows anyway". An agent that can't get there stops, reports BLOCKED with the precise sticking point, and writes nothing — that goes back to the author as a hint-quality finding. A plausible off-hint proof is the failure mode.
5. **Verify every returned solution before it lands.** Read each one against its hint chain step by step, and against the math. Nothing enters the `.tex` on an agent's say-so.
6. **Then run `handout-review`** for an independent per-problem math pass on top of your own read.

## Writing solutions for new problems

When adding new problems, or writing solutions for problems that have no hints:

1. **Know the solution first.** Solve it, or ask — the user often has the official solution to hand, which is cheaper and safer than grinding one out. If you can't solve it and it isn't supplied, say so rather than bluffing a proof.
2. **Write per the prose rules** — discovery-arc (motivate where the key idea comes from), self-contained, mirror the author's voice.
3. **Verify at the end** via `handout-review`, same as always.

**Never write the hints.** Hints are the author's to write — do not compose or rewrite them yourself. If a new problem needs hints, leave the slots empty for the author; at most flag that they're missing.

**The same applies to the theory sections and the intro.** Hints, `\sec Teória` / `\sec Úvod` prose, and the connective narration between theorems are the author's own writing — leave them alone unless asked for specifically. Solution bodies are the opposite: usually AI-written, not the author's voice, and rewriting them wholesale is in scope. So "fix the wordiness/style of this handout" means the solutions and nothing else. Confirm the scope rather than assuming it reaches the theory, and never sweep surrounding prose in on the grounds that it matches.

## Proposing statement or hint fixes

Sometimes the flaw is in the problem, not the solution — the statement admits a degenerate edge case, the question or a hint claims more than the solution proves, or it states the wrong answer. Flag it and propose the fix as a question; prefer fixing the statement (e.g. ruling out the edge case by hypothesis) over a mid-proof caveat that works around it. Correcting such a factual error in an existing statement or hint — with the author's sign-off — is fine, and is narrower than composing new hints, which you don't do.

## When the changes introduce new figures

If the edit adds brand-new `\Image{...}` references to figures that don't yet exist, do the work in this order:

1. Write the new `.asy` files in `data/handouts/Images/` and render them via `export-asy.sh` (produces `.pdf` + `.svg`) — the `handout-figure` skill is the appropriate context for this step.
2. Edit the `.tex` to add the `\Image{...}` lines and any surrounding prose.
3. Compile `pdfcsplain` once as the final verification step.

**Why:** editing the `.tex` first means the intermediate compile fails with "cannot find image file …" — a noisy, distracting failure that signals nothing useful. Doing figures first means the only compile run is real end-to-end verification, and a non-zero exit is then a real problem worth investigating.

If figures already exist (only `.tex` is changing), the order doesn't matter and compile-as-you-go is fine.

## Compilation

Run from the handouts directory (`data/handouts/`):
```
pdfcsplain -interaction=nonstopmode -halt-on-error "filename.tex"
```
To audit a file against the display-width rule, don't read widths off `Overfull` warnings — they point at a closing brace, not the wide display. Measure them: [tex-diagnostics.md](tex-diagnostics.md).

Ignore all warnings — do not investigate, fix, or mention them — with one exception: **`Overfull \hbox` warnings must be fixed**. Find the offending line from the snippet TeX prints below the warning (the reported line number usually points at the enclosing macro's closing brace, not the prose). Prefer relaxing a `~` (→ space) on that line, but never one tying a one-letter word (CS/SK `a, i, k, o, s, u, v, z`; EN `a, I`) — that strands the letter at line end. If no safe `~` exists or relaxation doesn't shift TeX's break, do a small prose rewrite (drop a particle, tighten a phrase). Recompile after each attempt.

---

## Macro reference

```
\Definition{#1 name}{#2 statement}
\Exercise{#1 source}{#2 statement}{#3 solution}
\Example{#1 source}{#2 statement}{#3 solution}
\Theorem{#1 source}{#2 statement}{#3 proof}
\Problem{#1 stars}{#2 source}{#3 statement}{#4 hint1}{#5 hint2}...{#n solution}
```

**`\EnvId{<nanoid>-<name>}`** — a marker on the line directly above one of the five environment macros above, carrying two things at once. Every environment must have one, and the build fails with a list of those that don't.

- The first 21 characters are the **id**: an opaque nanoid, drawn from `[A-Za-z0-9_-]`, exactly as a handout's own content id looks. It is permanent identity — a saved AI-examiner defense conversation is keyed on it, and it is the same in every language variant. **Never invent, drop, or rewrite an existing id.** When adding a brand-new environment, mint a fresh one with `npx nanoid` — never type one by hand.
- Everything after the 21st character's following hyphen is the **name**: a readable lowercase slug (`[a-z0-9-]`, ASCII, no diacritics, 2-5 words) that lands in the page URL as `#env-<name>` and must be unique within its file. Each language variant writes its own, in its own language.

Write the name from **what the statement visibly says** — the objects involved and what is asked. Never name the competition source, the solution technique, the identity or theorem that cracks it, the key modulus, or the answer, even when you know them: a reader sees the name in the URL before they have solved anything. A title the environment already displays is fair game, since the reader sees that too. Renaming later is free and needs no database change; the id is what must never move.

**`\Problem` stars argument** must be a non-negative integer (`0`, `1`, `2`, …). Never leave it empty (`{}`). Use `{0}` when the difficulty is unspecified — `{0}` renders no stars, so a handout that conveys difficulty purely by problem ordering carries `{0}` throughout.

**`\Problem` source argument** names the competition by **year**, never by ročník ordinal: `MEMO 2015 T2`, `IMO 2008 P4`, `ISL 2017, A6`, `Moskva 2011`. Give the problem number whenever it's known; if you're unsure which problem it was, leave the source bare rather than guessing a number into it. Czech/Slovak domestic MO rounds are written `Czech-Slovak <year>` with no round/category code — convert the ročník with **year = ročník + 1951** (75 → 2026), that being the year the round was held. This is a forward rule: 13 existing files still carry the ordinal forms (`MO 64-A-I-5`, `74-CSMO-A-II-1`, `70-CPSJ-I-4`, `74. ročník MO, krajské B`, 56 uses), so expect a counterexample in the very file you are editing and don't mirror it.

**`\Answer{result}`** — an optional final answer (a number, expression, yes/no) for a `\Problem`, `\Exercise`, or `\Example`. Place it at the START of the solution argument, with the worked solution on the next line; it renders as an italic `Výsledok:` / `Výsledek:` / `Answer:` line above the solution and feeds a separate collapsible answer on the web. Omit it for proof-style problems with no short result — never write `\Answer{}`. Example:
```tex
}{
    \Answer{Dve riešenia: $(1,1)$ a~$(-1/2,-1/2)$.}
    Odčítaním rovníc dostaneme \dots
}
```

**`\NamedProof{caption}`** — `\Theorem` auto-prepends an italic `Dôkaz.` (or `Důkaz.` / `Proof.`) caption to its proof argument. `\NamedProof` at the START of the proof body REPLACES that caption with `caption` italicized. Use ONLY when `caption` already plays the role of "Dôkaz." — i.e. it contains/replaces the word, as in `\NamedProof{Dôkaz 1 (matematická indukcia).}` to label one of several alternative proofs. Do NOT use it for sub-case markers like `(⇒)`, `(⇐)`, `Priama implikácia.`, `Obrátená implikácia.` — those are case headers WITHIN one proof, and the default `Dôkaz.` must remain. For those, write plain `\textit{($\Rightarrow$)}` at the start of the case; the rendered output is `Dôkaz. (⇒) ...`, which is the intended look.

When the user asks to **reformat or transcribe** (e.g. "convert this old format", "add these problems"), copy content faithfully — do not invent, improve, or fill in solutions. Leave solution arguments as `{}` if no solution is provided.

### Canonical `\Problem` example

```tex
\EnvId{V8pQ2mZxK7nLrT4wYc1Db-acute-triangle-orthocenter}
\Problem{1}{IMO 2013, G1}{
    Let $ABC$ be an acute triangle with orthocenter $H$ \dots
}{
    Hint pointing toward the key idea.
}{
    The key point is $T$ \dots
}
```

A problem with no hint and no solution looks like `\Problem{0}{}{Statement.}{}`.

---

## TeX / format rules

1. **Stack:** PlainTeX + AMS-TeX + OPmac only. No `\begin...\end` LaTeX environments. Use `\align`, `\eqalign`, `\cases`, `\gather`, `\matrix`, `\pmatrix`, `$$...$$`.
2. **Display math:** `$$...$$` must always be split across three lines — the formula never sits on the same line as the delimiters:
   ```tex
   $$
   x^2 + y^2 = z^2.
   $$
   ```
3. **Lists:** Use `\begitems ... \enditems` with `\i` only for genuine casework or classification.
4. **Typography:** `\textbf{}`, `\textit{}` only. No `\em`, `{\bf ...}`, etc.
5. **Scope:** Do not touch preamble, fonts, or layout. Keep UTF-8 accents. No new packages or macros.
6. **No section labels in solutions:** Do not start solutions with `\textbf{Řešení.}`, `\textbf{Riešenie.}`, etc.
7. **Dashes:** Never write an em dash at all — not the UTF-8 `—` and not TeX's `---`. Recast per sentence: a colon where it introduced an explanation, a full stop where what follows is an independent clause, a comma for a tight aside, parentheses for an appositive that already contains a comma. For an en dash write TeX's `--`, never the UTF-8 `–`; the en dash is the normal SK/CS aside dash and is fine throughout, so grep `---` only. This is the one place the ban applies to **the author's** prose as well as yours (it overrides the general "don't rewrite existing prose" rule, which the author waived here), so fix the author's `---` on sight rather than flagging them. `---` survives in 9 handouts (69 uses, 63 of them in `adding-points.*`); as with ties, the rule wins and those files are not precedent.
8. **Ties (`~`) go after one-letter words ONLY.** CS/SK `a, i, k, o, s, u, v, z` (and their capitals), EN `a, I`. Everywhere else write a plain space: `pomocou $y$`, not `pomocou~$y$`. Stranding a one-letter preposition at a line end is the actual typographic sin; tying `máme~`/`každé~`/`resp.~`/`,~` is just noise, and on a phone a stray non-breaking space wraps badly. Grep a finished file with `grep -oE '[A-Za-zÀ-ž.,]+~' file.tex | sort | uniq -c` — anything with two or more letters before the `~` is wrong.

   Two consequences. First, **vocalized prepositions are two letters and so take a plain space in both languages**: SK `ku `, `so `, `zo `, `vo ` and CS `ke `, `se `, `ze `, `ve `, never `ku~` or `ke~`. The repo still contradicts this (CS `ke~`×16, `ve~`×14, `ze~`×9, `se~`×3; SK `ku~`×3, `so~`/`vo~`/`zo~`×1 each) — the rule wins, and don't let an agent cite those files as precedent. Second, **`k` vs `ke` is decided by how the *following token is read aloud*, not by its first character**: `ke kružnici` (before `k`) but `k~$\omega$`, because `$\omega$` reads "ómega" and starts with a vowel. Same for `$\Omega$` and for circle names like `$(ABC)$`.
9. **An `\eqno` is for pointing back from a distance.** Number an equation only when the text cites it from further away than the paragraph directly below; when the single reference sits in the next sentence, write "táto rovnica" / "posledný vzťah" and leave the display untagged. Renumber a block's survivors to run from `(1)`, and keep both numbers where one sentence cites two equations.
10. **Display equations must stay narrow enough for a phone.** Keep each typeset line under ~75% of `\hsize`. Split at an `=`, with the continuation line starting `= …`, using `\gather … \endgather`; when the display carries an `\eqno`, use `\eqalign{…}` instead, since `\gather` is AMS-TeX's own display environment and wants `\tag`, not `\eqno`.

---

## Prose style

- **Mirror the author's style strictly.** Before writing, read existing solutions/exercises in the same file. Match the author's voice — sentence length, level of formality, how explicitly steps are spelled out, idiomatic word choices and short phrases. Your additions should be indistinguishable from the existing content. Do not inflate with synonyms or impose your own voice.
- **Self-contained.** Solutions must stand alone — every named object, auxiliary point (`$B'$`, `$M$`, `$O$`, …), or construction used by the reasoning must be (re)introduced inside the solution body, even if it also appears in a hint. The reader may skip hints entirely.
- **Elegant and elementary.** Prefer the prettiest elementary route that aligns with the provided hints. Never contradict or bypass them.
- **No bashing.** Do not reach for trigonometry, coordinates, vectors-as-algebra, or complex numbers when a synthetic argument exists. These are teaching handouts about beautiful ideas, not about grinding, and a computational route teaches the reader nothing even when it is correct. The temptation is real precisely because bashing is the reliable way to close a problem you can already see the end of — that is the reflex to suppress. If a bash is the only route you can find, treat it as a signal you have not found the intended one: reread the hints, and report BLOCKED rather than submitting the grind.
  - *Escape hatch:* when the handout is itself about the technique (a trigonometry, coordinates, or complex-numbers handout, or a section explicitly billed as bashing), the technique is the point and this rule does not apply. Judge from the `\sec Úvod` and the surrounding solutions, not from the problem.
  - *Smaller version of the same thing:* a lone $\sin$, $\cos$ or $\tan$ smuggled into an otherwise synthetic proof to finish a length or angle comparison. Look for the congruence, the similar triangles, or the equal-tangent argument that replaces it; there almost always is one. (The law of sines/cosines used once as a genuine named tool in an otherwise synthetic chain is fine; a computation dressed as a proof is not.)
- **Retrace the discovery; don't assert-then-verify.** When the hints scaffold *how to find* a key claim, invariant, or magic constant — small cases that expose a pattern, a substitution the structure suggests, a backward analysis that pins down the answer — the solution must arrive at it the same way, motivating where it comes from in a sentence or two, not state it from nowhere and merely check it works. A correct solution that pulls its key object out of a hat bypasses the hints even though it never contradicts them.
- **Calibrate to the handout's own reader, and work out who that is first.** There is no house register: `factorization.sk.tex` is deliberately wordy because it is for kids, and writing an advanced handout in that voice gets the solutions thrown back. The `\sec Úvod` usually names the audience outright, and the problem sources settle the rest. Either way: name the strategic move (auxiliary point, substitution, which criterion/identity), execute the rest in math, and skip prose on trivial sub-steps (shared sides, restating the previous line, naming an angle right after computing $180^\circ-\alpha$).
  - *Beginner handout* — one-line nudges between display blocks are fine; paragraph-length recaps aren't.
  - *Olympiad-level* — cut further: no discovery narration beyond a single motivating sentence where the idea is genuinely surprising, no restating the statement, no closing flourish, no bonus remark, one clause (not a paragraph) for a load-bearing betweenness or sign check, and a half-sentence on an angle chain only for the step that isn't immediate.
- **`\Image` placement.** In multi-paragraph solutions/proofs, place `\Image{...}` between paragraphs — not as the opening line and not as the closing line. Drop it right after the paragraph that constructs/names what the figure shows. Single-paragraph solutions are exempt.
- **`\Image` scale.** Default to no scale argument — write `\Image{<file>.pdf}`, not `\Image{<file>.pdf}{0.8}`. 
- **End a "find all" solution with the skúška.** Every derivation that only shows what a solution *must* look like is one-directional, so the check back into the original equation is part of the proof, not decoration. Match the file's one-sentence form: `Skúškou overíme, že táto funkcia vyhovuje: ľavá strana je …, a~pravá …`. Exempt only when nothing is being solved for — e.g. "find the roots of $f(f(x))=0$ given a hypothesis on $f$" has nothing to substitute back.

## Language-specific phrasing

- **SK/CS quotes.** Use `\uv{text}` for quoted words, never the `,,text''` double-comma style.
- **American English** (when `\setlanguage{EN}`). Use American spellings throughout: -ize not -ise, -or not -our, -er not -re (center/incenter/excenter/orthocenter/circumcenter, not centre/incentre/…), practice (verb and noun).
- **EN angle notation:** Write `$\angle XYZ$`, never `$|\angle XYZ|$`. The absolute-value bars around angles are CS/SK convention only.
- **EN length notation:** Write `$AB$`, never `$|AB|$`. The absolute-value bars around segment lengths are CS/SK convention only. Three things the bars were silently doing, which you must restore by hand once they are gone:
  - After a control sequence, keep a space so the control word still ends: `\neq|AC|` → `\neq AC`.
  - **A primed endpoint before an exponent needs parentheses.** `|ZX'|^2` → `ZX'^2` is `Double superscript` and a **fatal** error, because `'` already means `^\prime`. Write `(ZX')^2`. Grep the finished file for `'\^` and expect zero hits.
  - **A coefficient in front needs an explicit `\cdot`.** `$k|AB|$` → `$kAB$` reads as one three-letter identifier, not a product. Write `$k \cdot AB$`.
