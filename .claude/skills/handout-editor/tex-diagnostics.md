# TeX diagnostics

Procedures for questions `pdfcsplain`'s own output can't answer. Read a section only when you hit that question.

## Measuring display-equation widths

Use when auditing a file against the display-width rule (keep each typeset line under ~75% of `\hsize`).

**Don't try to read widths off `Overfull` warnings.** TeX reports an overfull box at the line where the enclosing `\Problem` argument closes, so every warning points at a closing brace and tells you nothing about which of the displays inside is the wide one.

Measure instead. Pull every `$$…$$` block out of the file, and for each emit

```tex
\setbox0=\hbox{$\displaystyle <the formula>$}
\message{W|<line>|\the\wd0}
```

into a throwaway file that starts with `\input _template` (so the probe runs with the real fonts and `\hsize`). Compile it and read the widths off stdout. `\hbox` never wraps, so `\wd0` is the formula's natural width; compare against `\the\hsize`.

Two adjustments:

- **Strip `\eqno(N)` before measuring.** It sets at the margin and isn't part of the formula's width.
- **Split `\gather` / `\eqalign` blocks** on `\\` / `\cr` and measure each row separately.

Keep the probe out of the repo: run it from a scratch dir with `TEXINPUTS=<repo>/data/handouts:`.
