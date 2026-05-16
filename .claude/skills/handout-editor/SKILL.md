---
name: handout-editor
description: Use this skill when editing one olympiad math handout file — filling solutions, reformatting/transcribing, adding problems, or polishing prose. Operates on the PlainTeX+AMS-TeX+OPmac stack used by this project. Do NOT use for full-handout translation between CS/SK/EN (use `handout-translate`) or for applying a change across multiple language variants (use `handout-propagate`).
---

# Handout Editor

You are a professional olympiad math writer, editor, and translator. Help curate, write, translate, and compile handouts in the PlainTeX+AMS-TeX+OPmac stack used by this project.

## Scope

**Edit `.tex` files only.** JSON files under `web/src/content/` are auto-generated — never read, edit, or reference them.

## Workflow

1. If the user hasn't specified what to do, ask. Common modes: fill solutions, reformat/transcribe, add new problems.
2. Read the relevant `.tex` file(s) with the Read tool if working on an existing file. If the user pastes content inline, work from that directly.
3. Make the requested changes.
4. After every edit, compile and verify. If compilation fails with exit code ≠ 0, fix the error and recompile.
5. Report what changed (one sentence).

## Compilation

Run from the handouts directory (`data/handouts/`):
```
pdfcsplain -interaction=nonstopmode -halt-on-error "filename.tex"
```
Exit code 0 = success. Ignore all warnings — do not investigate, fix, or mention them.

---

## Macro reference

```
\Definition{#1 name}{#2 statement}
\Exercise{#1 source}{#2 statement}{#3 solution}
\Example{#1 source}{#2 statement}{#3 solution}
\Theorem{#1 source}{#2 statement}{#3 proof}
\Problem{#1 stars}{#2 source}{#3 statement}{#4 hint1}{#5 hint2}...{#n solution}
```

**`\Problem` stars argument** must be a non-negative integer (`0`, `1`, `2`, …). Never leave it empty (`{}`). Use `{0}` when the difficulty is unspecified.

When the user asks to **reformat or transcribe** (e.g. "convert this old format", "add these problems"), copy content faithfully — do not invent, improve, or fill in solutions. Leave solution arguments as `{}` if no solution is provided.

### Canonical `\Problem` example

```tex
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
- **Self-contained.** Solutions must stand alone — do not rely on hints. Pull in any essential fact briefly.
- **Elegant and elementary.** Prefer the prettiest elementary route that aligns with the provided hints. Never contradict or bypass them.
- **Calibrate to a strong school student starting olympiads.** Name the strategic move (auxiliary point, substitution, which criterion/identity); execute the rest in math. Skip prose on trivial sub-steps — shared sides, restating the previous line, naming an angle right after computing $180^\circ-\alpha$. One-line nudges between display blocks are fine; paragraph-length recaps aren't.
- **`\Image` placement.** In multi-paragraph solutions/proofs, place `\Image{...}` between paragraphs — not as the opening line and not as the closing line. Drop it right after the paragraph that constructs/names what the figure shows. Single-paragraph solutions are exempt.

## Language-specific phrasing

- **American English** (when `\setlanguage{EN}`). Use American spellings throughout: -ize not -ise, -or not -our, -er not -re (center/incenter/excenter/orthocenter/circumcenter, not centre/incentre/…), practice (verb and noun).
- **EN angle notation:** Write `$\angle XYZ$`, never `$|\angle XYZ|$`. The absolute-value bars around angles are CS/SK convention only.
- **EN length notation:** Write `$AB$`, never `$|AB|$`. The absolute-value bars around segment lengths are CS/SK convention only. When removing `|...|` from a length that follows a TeX control sequence (e.g. `\neq|AC|`), ensure a space separates the control word from the next token: `\neq AC`.
