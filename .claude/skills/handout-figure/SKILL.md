---
name: handout-figure
description: Use this skill when editing or adding handout figures — Asymptote `.asy` files in `data/handouts/Images/`. Adding/modifying geometry, angle marks, fills, colors, labels, then re-rendering to PDF + SVG. Trigger phrases: "add a 60° angle to that figure", "change the color in the figure", "redraw", "fix the figure", "make X visible", anything touching a `.asy` under handouts. Do NOT use for editing the `.tex` that embeds the figure — that's `handout-editor`.
---

# Handout Figure Editor

You edit Asymptote figures in `data/handouts/Images/`. Source is `.asy`; both `.pdf` (handout PDF) and `.svg` (website) are committed and must stay in sync with the source.

## Scope

- Edit `.asy` files in `data/handouts/Images/`.
- Re-render every modified figure via `_Export-Asy.ps1` — never raw `asy.exe`.
- Do not touch the `.tex` that embeds the figure — that's `handout-editor`.

## Workflow

1. **Identify the figure.** The user may name the slug (e.g. `angles-pentagon`) or paste a `\Image{...}` line. The file is `data/handouts/Images/<slug>.asy`.
2. **Read `_common.asy`** if you don't recall its primitives — `Draw`, `Circle`, `AngleMark`, `RightAngleMark`, `LabeledDot`, `EdgeLabel`, `ParallelMark`, `EquilateralTriangle`, `Midpoint`, `Foot`, `ReflectAcross`, `Polar`, `ExtendPast`.
3. **Check for a shared module.** If `<topic>-shared.asy` exists, the figure is part of a statement/solution pair: geometry and base layers live in shared; individual files call `BaseFills() / BaseEdges() / BaseDots()` and add only their own marks.
4. **Edit.** Strict draw order: **fills (incl. AngleMark sectors) → edges → dots → standalone labels.**
5. **Re-render** from `data/handouts/Images/`:
   ```
   pwsh -NoProfile -File ./_Export-Asy.ps1 <slug>.asy
   ```
   Produces deterministic-metadata PDF and Inkscape-converted SVG. Both get committed.
6. **Report** one sentence — what changed in the figure.

## Palette and styling

- **6 hue families × 3 shades** in `_common.asy`: `LightBlue/Blue/DarkBlue`, `LightRed/Red/DarkRed`, `LightGreen/Green/DarkGreen`, `LightPurple/Purple/DarkPurple`, `LightPink/Pink/DarkPink`, `LightYellow/Yellow/DarkYellow`. Always pick a named pen — never inline `rgb(...)`.
- **`AngleMark` / `RightAngleMark` take a `Light*` pen** — they fill a sector with no edge stroke, so a saturated pen reads heavy. For `labelPen` use a Normal/Dark pen or a `Font*` tier (e.g. `labelPen = Red`, `labelPen = Font2`).
- **Line widths**: three tiers only — `ThinWidth = 0.5`, `NormalWidth = 1.0`, `ThickWidth = 1.5`. `Draw`/`Circle`/`vertexPen` apply these automatically.
- **Font tiers**: `Font1..Font5` (8 / 10 / 13 / 16 / 20 pt). `Font3` is the default. Pass via `labelPen` for narrow sectors or dense figures.
- **Opacity is forbidden** except for genuinely overlapping translucent fills (two filled regions where the overlap should read deeper). For non-overlapping fills, pick a different `Light*` shade instead.

## Comments in figure files

- **Minimal.** Only math/geometry-derivation comments. No file headers, no section dividers, no inline narration of `Draw` / `LabeledDot` calls. `_common.asy` itself is exempt — its helpers carry full doc blocks.
- **For new helpers** (in `_common.asy` or `<topic>-shared.asy`): each parameter on its own line, framed `//` docstring above the function, verb-first prose, matching the style already in the file.

## Gotchas

- **Asymptote strings**: only `\"` is escaped. Write `"\alpha"` (one backslash) for LaTeX — `"\\alpha"` renders a newline followed by `alpha`.
- **`include "<topic>-shared.asy";`** must be quoted — hyphens are illegal in bare identifiers. `import _common;` works because `_common` is a valid identifier.
- **Don't name point variables `N`, `S`, `E`, `W`, `NE`, …** — those shadow asy's compass constants, breaking `LabeledDot(P, "P", N)`. If you need a point at those positions, give it a different name and pass `(0,1)` etc. as alignment.
- **Figure pairs** that share geometry → extract to `<topic>-shared.asy` (no `_` prefix — that's reserved for handout-wide modules like `_common`; `-shared` suffix sorts next to its siblings). Split into `BaseFills()`, `BaseEdges()`, `BaseDots()` so each figure layers its own marks in the right order.

## Rules

- **Never call `asy.exe` directly for committed changes** — `_Export-Asy.ps1` is the canonical pipeline (deterministic PDF metadata + Inkscape SVG matching the rest of the project).
- **Never inline `rgb(...)`, `fontsize(...)`, ad-hoc widths, or stray `opacity(...)`** — extend the palette in `_common.asy` if a missing shade is genuinely needed (the user OK'd `LightYellow` etc. this way), but don't sprinkle one-offs.
- **Never edit `<topic>-shared.asy` to change a single figure's marks** — only geometry and `Base*` layers belong there.
