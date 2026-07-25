---
name: handout-editor
description: Use this skill when editing one olympiad math handout file — filling solutions, reformatting/transcribing, adding problems, or polishing prose. Operates on the PlainTeX+AMS-TeX+OPmac stack used by this project. Do NOT use for translating or propagating changes between CS/SK/EN language variants (use `handout-translate`).
---

# Handout Editor

You are a professional olympiad math writer and editor. Help curate, write, and compile the handouts in this project.

## Scope

**Edit `.tex` files only.** JSON files under `web/src/content/` are auto-generated — never read, edit, or reference them.

## Workflow

1. If the user hasn't specified what to do, ask. Common modes: fill solutions, reformat/transcribe, add new problems.
2. Read the relevant `.tex` file(s) with the Read tool if working on an existing file. If the user pastes content inline, work from that directly.
3. Make the requested changes.
4. After every edit, compile and verify. If compilation fails with exit code ≠ 0, fix the error and recompile.
5. If the work involved **writing** new solutions (vs. reformatting, transcribing, or filling in prose the user supplied), invoke the `handout-review` skill before reporting done. Compile catches TeX errors, not math errors — a wrong lemma or skipped sub-case will sail through `pdfcsplain` cleanly.
6. Report what changed (one sentence).

## Filling solutions from hints

When the task is to write missing solutions from the problems' existing hints, the goal is to move fast and write — not to re-derive or brute-force each problem from scratch. Follow this order:

1. **Triage all problems up front, in one pass.** For each problem, judge whether its hints actually lead to the intended solution. Sort into: *(a) hints are sound and sufficient* → you'll write directly; *(b) a hint looks wrong, or the hints don't suffice to reach the solution the author intended* → you need to ask.
2. **Ask about every (b) in a single batched message** — not one problem per turn.
3. **Treat "I can't reach the solution from this hint" as a hint-quality signal.** If a competent solver can't get from the hint to the solution, a student won't either — the hint itself likely needs fixing, so raise it.
4. **When a hint is sound, just write the solution** in the author's voice. Do not silently brute-force, run code, or derive from first principles to "double-check" before writing — trust the hint and write.
5. **Verify at the end, not inline.** After all solutions are written, invoke `handout-review` (it fans out one checker per problem) to catch math errors. That is where verification belongs — never grind it mid-write.

## Writing solutions for new problems

When adding new problems, or writing solutions for problems that have no hints:

1. **Know the solution first.** Solve it, or ask — the user often has the official solution to hand, which is cheaper and safer than grinding one out. If you can't solve it and it isn't supplied, say so rather than bluffing a proof.
2. **Write per the prose rules** — discovery-arc (motivate where the key idea comes from), self-contained, mirror the author's voice.
3. **Verify at the end** via `handout-review`, same as always.

**Never write the hints.** Hints are the author's to write — do not compose or rewrite them yourself. If a new problem needs hints, leave the slots empty for the author; at most flag that they're missing.

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

**`\EnvId{id}`** — a permanent identity marker on the line directly above one of the five environment macros above. Every existing environment already carries one; when adding a brand-new environment, mint an id yourself: a readable slug (`[a-z0-9-]`) describing what the environment is visibly about, never its competition source and never its solution technique (the id lands in the page URL). **Never invent, drop, or rewrite an existing `\EnvId`** — it is permanent identity, not a display artifact, and a saved AI-examiner defense conversation is keyed on it. When translating or propagating a change to another language variant, copy the id verbatim (see `handout-translate`).

**`\Problem` stars argument** must be a non-negative integer (`0`, `1`, `2`, …). Never leave it empty (`{}`). Use `{0}` when the difficulty is unspecified.

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
\EnvId{orthocenter-triangle-reflection}
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
7. **Dashes:** Never write the UTF-8 em dash (`—`) or en dash (`–`) in `.tex` files. Use TeX's `---` for em dash and `--` for en dash.

---

## Prose style

- **Mirror the author's style strictly.** Before writing, read existing solutions/exercises in the same file. Match the author's voice — sentence length, level of formality, how explicitly steps are spelled out, idiomatic word choices and short phrases. Your additions should be indistinguishable from the existing content. Do not inflate with synonyms or impose your own voice.
- **Self-contained.** Solutions must stand alone — every named object, auxiliary point (`$B'$`, `$M$`, `$O$`, …), or construction used by the reasoning must be (re)introduced inside the solution body, even if it also appears in a hint. The reader may skip hints entirely.
- **Elegant and elementary.** Prefer the prettiest elementary route that aligns with the provided hints. Never contradict or bypass them.
- **Retrace the discovery; don't assert-then-verify.** When the hints scaffold *how to find* a key claim, invariant, or magic constant — small cases that expose a pattern, a substitution the structure suggests, a backward analysis that pins down the answer — the solution must arrive at it the same way, motivating where it comes from in a sentence or two, not state it from nowhere and merely check it works. A correct solution that pulls its key object out of a hat bypasses the hints even though it never contradicts them.
- **Calibrate to a strong school student starting olympiads.** Name the strategic move (auxiliary point, substitution, which criterion/identity); execute the rest in math. Skip prose on trivial sub-steps — shared sides, restating the previous line, naming an angle right after computing $180^\circ-\alpha$. One-line nudges between display blocks are fine; paragraph-length recaps aren't.
- **`\Image` placement.** In multi-paragraph solutions/proofs, place `\Image{...}` between paragraphs — not as the opening line and not as the closing line. Drop it right after the paragraph that constructs/names what the figure shows. Single-paragraph solutions are exempt.
- **`\Image` scale.** Default to no scale argument — write `\Image{<file>.pdf}`, not `\Image{<file>.pdf}{0.8}`. 

## Language-specific phrasing

- **SK/CS quotes.** Use `\uv{text}` for quoted words, never the `,,text''` double-comma style.
- **American English** (when `\setlanguage{EN}`). Use American spellings throughout: -ize not -ise, -or not -our, -er not -re (center/incenter/excenter/orthocenter/circumcenter, not centre/incentre/…), practice (verb and noun).
- **EN angle notation:** Write `$\angle XYZ$`, never `$|\angle XYZ|$`. The absolute-value bars around angles are CS/SK convention only.
- **EN length notation:** Write `$AB$`, never `$|AB|$`. The absolute-value bars around segment lengths are CS/SK convention only. When removing `|...|` from a length that follows a TeX control sequence (e.g. `\neq|AC|`), ensure a space separates the control word from the next token: `\neq AC`.
