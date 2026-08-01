---
name: handout-figure
description: Use this skill when editing or adding handout figures — Asymptote `.asy` files in `data/handouts/Images/`. Adding/modifying geometry, angle marks, fills, colors, labels, then re-rendering to PDF + SVG. Trigger phrases — "add a 60° angle to that figure", "change the color in the figure", "redraw", "fix the figure", "make X visible", anything touching a `.asy` under handouts. Do NOT use for editing the `.tex` that embeds the figure — that's `handout-editor`.
---

# Handout Figure Editor

You edit Asymptote figures in `data/handouts/Images/`. Source is `.asy`; the `.svg` (website) is committed and must stay in sync with the source. The `.pdf` (handout PDF) is a build artifact — rendered locally, gitignored, regenerated on demand.

## Workflow

1. **Identify the figure.** The user may name the slug (e.g. `angles-pentagon`) or paste a `\Image{...}` line. The file is `data/handouts/Images/<slug>.asy`.
2. **Primitives in `_common.asy`**: `Draw`, `DashedDraw`, `DashDotDraw`, `DottedDraw`, `PatternDraw`, `Circle`, `Arc`, `AngleMark`, `RightAngleMark`, `LabeledDot`, `VertexDot`, `VertexDots`, `PointLabel`, `EdgeLabel`, `ParallelMark`, `EquilateralTriangle`, `Midpoint`, `Foot`, `ReflectAcross`, `Polar`, `ExtendPast`, `LineCircleIntersections`, `RadicalAxis`, `Circumcenter`, `TangentPointsFromExternal`, `CommonExternalTangent`, `CommonExternalTangentAwayFrom`, `CommonInternalTangent`. Read `_common.asy` only for a signature this skill doesn't document — and read the copy in **this** `Images/` directory, never `~/.asy/_common.asy`. That symlink points at the main checkout, so in a worktree it lags any unmerged library change; `export-asy.sh` passes `-cd`, so the local file is what actually compiles. Note `LineCircleIntersections` returns its two points **ordered along `A → B`**, so which one is "near" depends on the direction you passed — check before picking label compass directions.
3. **Check for a shared module.** If `<topic>-shared.asy` exists, the figure is part of a statement/solution pair: geometry and base layers live in shared; individual files call `BaseFills() / BaseEdges() / BaseDots()` and add only their own marks.
4. **Re-render** from `data/handouts/Images/`:
   ```
   bash export-asy.sh <slug>.asy
   ```
   The script is committed non-executable, so `./export-asy.sh` fails with permission denied — always go through `bash`. Produces the PDF (local preview / handout compile) and the `asy`-rendered SVG.
5. **Check the natural width** against the budget below — `grep -o "width='[0-9.]*pt'" <slug>.svg`.
6. **Visually verify** the rendered PDF with the `Read` tool before reporting done — wrong-side angle marks, label collisions, and clipping issues are obvious in the image but invisible in the source. The render exit code only tells you the file compiled.
7. **Report** one sentence — what changed in the figure.

## Figure size — the phone budget

A figure's physical size *is* the magnitude of its coordinates (`unitsize(1pt)`, no `size()` clamp), while pens and fonts are absolute. Nothing downstream rescales it up: **a figure shrinks on a narrow screen but never grows**, and there is no tap-to-zoom. The phone is the binding constraint, never print.

- **Cap natural width at 185pt** (≈246px) — the widest figure that never downscales, even on a 320px phone. A ceiling, not a target.
- **Target 90–120pt tall.** Height is the constraint you actually get told about: it decides how big a bite the figure takes out of the page next to a one- or two-line statement. Past ~140pt needs a reason.
- **A circle-dominated figure is roughly as tall as it is wide, so sizing it by width is the trap.** Hitting the height target puts such figures at ~110–150pt wide — deliberately under the width band, and correct. Wide-and-short figures (a triangle, a point-and-secant layout) can use the full width.
- **Keep a handout's figures within a narrow band**, banded on whichever dimension dominates them. Below roughly 100pt across, 13pt labels start to dominate whatever the shape.
- **Never pass `\Image` a `scale` argument to shrink a too-wide figure.** Scale multiplies the max-width, so it makes the phone case worse. Author at the target size instead.

Measured viewport widths and the arithmetic behind these numbers: [figure-sizing.md](figure-sizing.md).

**Never use `pattern()` / `HatchedFill`.** It forces Ghostscript rasterization of the whole figure: `equal-tangents-checkerboard.svg` is a 313 KB embedded JPEG with zero `<path>` elements, where every vector figure in the directory is ~1–25 KB of `<path>`. Use a `Light*` fill instead.

## Source layout

- **Parametrize coordinates.** Extract numeric coordinates into top-level `real` constants at the top of the file, then build `pair`s from them — don't hard-code numbers inside `pair` declarations. Example: instead of `pair A = (-90, 0); pair B = (90, 0); pair X = (-120, 120);`, write
  ```asy
  real halfBase = 90;
  real apexHeight = 120;
  pair A = (-halfBase, 0);
  pair B = (halfBase, 0);
  pair X = (-halfBase - 30, apexHeight);
  ```
  Retuning the figure is then a one-constant edit; geometry intent reads from the names. Established pattern — `angles-pentagon.asy` (`real alpha, lenBC, lenDE`), `angles-isosceles-triangle.asy` (`real base, height`), `angles-circumcenter.asy` (`real R, pastMidpoint, pastO`).
- **Naming.** Prefer names that encode geometric role (`R`, `alpha`, `lenBC`, `pastO`, `bisectorLeft`, `Xprime`) over generic `x/y` or code-style abbreviations (`bis`, `aux`, `ext`, `eR`, `iZ`). Math-language names are fine — single-letter symbols (`R`), Greek words spelled out (`alpha`), compound math nouns (`lenBC`, `pastO`) — but clipped English reads like a half-deleted variable name. Bare `x/y` is acceptable only when the figure is genuinely Cartesian.
- **Never put prose in a figure — labels are math symbols only.** The Handouts CLI uploads SVGs to `handouts/<slug>/<image>.svg` with the slug **language-stripped**, so every language variant shares one image set and there is no per-language override: a Slovak caption renders verbatim in the EN and CS variants. If a figure genuinely needs a caption, put it in the `.tex` between two `\Image` calls, where it translates.
- **Use compass constants for label alignment.** `LabeledDot(A, "A", S)` not `LabeledDot(A, "A", (0, -1))`. The compass set is `N`, `S`, `E`, `W`, `NE`, `NW`, `SE`, `SW`. **Exception:** when a point variable shadows a compass letter (e.g. pentagon vertex `E` shadows east), pass an explicit vector for that one label: `LabeledDot(E, "E", (1, 0))`.

## Palette and styling

- **6 hue families × 3 shades** in `_common.asy`: `LightBlue/Blue/DarkBlue`, `LightRed/Red/DarkRed`, `LightGreen/Green/DarkGreen`, `LightPurple/Purple/DarkPurple`, `LightPink/Pink/DarkPink`, `LightYellow/Yellow/DarkYellow`. Always pick a named pen — never inline `rgb(...)`.
- **`AngleMark` / `RightAngleMark` take a `Light*` pen** — they fill a sector with no edge stroke, so a saturated pen reads heavy. For `labelPen` use a Normal/Dark pen or a `Font*` tier (e.g. `AngleMark(C, B, A, LightRed, "\alpha", labelPen = Red)`, `labelPen = Font2`).
- **`AngleMark(X, Y, Z, color, ...)` — vertex is the MIDDLE arg, sweep is CCW from ray YX to ray YZ.** It does NOT auto-pick the smaller side (`while (d2 < d1) d2 += 360`). If the wedge fills the long way around, swap to `AngleMark(Z, Y, X, ...)` to reverse direction.
- **`RightAngleMark(A, O, B, ...)` is the opposite: orientation-independent.** It always marks the corner between rays OA and OB, so swapping `A`/`B` renders the identical L. Don't try to flip it. Its signature is also `(A, O, B, radius, color, filled)` — `color` is the FIFTH argument, after `radius`, not the fourth as in `AngleMark`.
- **Nested wedges sharing a vertex** (e.g. ∠YAB inside ∠XAB at A): draw the outer FIRST with a `Light*` pen at a larger radius, then the inner with the matching Normal pen at a smaller radius. Use this in place of `opacity()` for the "both angles visible despite overlap" case.
- **Paired equal-angle wedges meeting at a bisector ray** (e.g. ∠XAZ and ∠ZAY where AZ bisects ∠XAY): two wedges at the same radius merge into one arc cut by the bisector. Pass plain `Radius*` to the first AngleMark and the matching `Radius*Nudged` to the second — it scales the outer wedge by `WedgeNudge` so the pair stair-steps at the bisector. Established pattern: `angles-bisector-definition.asy`, `angles-bisectors-perpendicular.asy`.
- **Line widths**: three tiers — `ThinWidth = 0.5`, `NormalWidth = 1.0`, `ThickWidth = 1.5`. `Draw`/`Circle` apply `NormalWidth` automatically; `vertexPen` uses `ThinWidth`.
- **Font tiers**: `Font1..Font5` (8 / 10 / 13 / 16 / 20 pt). `Font3` is the default. Pass via `labelPen` for narrow sectors or dense figures.
- **Opacity is forbidden** except for genuinely overlapping translucent fills (two filled regions where the overlap should read deeper). For non-overlapping fills, pick a different `Light*` shade.

## Layout conventions

- **Triangle $ABC$**: $A$ at the top, side $BC$ horizontal along the bottom; vertices labeled counter-clockwise ($A$ top, $B$ bottom-left, $C$ bottom-right). For a scalene triangle place $A$ slightly off the vertical axis (e.g. `dir(100)` instead of `dir(90)`) so the figure isn't symmetric. With circumradius $R$ at the origin, `B = R*dir(180°+α)` and `C = R*dir(360°-α)` puts $BC$ on a horizontal line below the x-axis at the same $y$ for any $\alpha$.

## Layering order

Asymptote's z-order is purely insertion-order — call order IS layer order. Compose from background to foreground:

1. **Fills** — polygon backgrounds AND `AngleMark` / `RightAngleMark` sector fills.
2. **Colored edges** — anything non-black: `Circle(..., LightBlue)`, dashed bisectors (`DashedDraw(A, B, Green)`), distance segments.
3. **Black edges** — `Draw(A, B)` polygon sides, plain auxiliary lines.
4. **Dots** — `VertexDot` / `LabeledDot`.
5. **Standalone labels** — `label(...)` / `EdgeLabel(...)`.

Colored before black so the primary geometry (triangle sides, original lines) sits ON TOP of colored auxiliary marks — at any crossing the primary geometry stays crisp.

For a `*-shared.asy` module, split the base draw into `BaseFills()`, `BaseEdges()`, `BaseDots()` rather than one `DrawAll()`, so variants interleave at the right layer:

```asy
BaseFills();
// variant fills, including AngleMark calls
BaseEdges();
// variant edges
BaseDots();
// variant standalone labels
```

## Comments in figure files

Use comments sparingly. Keep **only** comments that explain a math formula or geometric derivation, or justify a non-obvious technical choice (law-of-cosines block, why a specific intersection root is taken, why a custom dot loop replaces `VertexDots`).

Remove everything else:
- File-header docstrings (`// filename.asy\n// Description: ...`).
- Section dividers like `// Vertices`, `// Edges`, `// Filled sectors`.
- Inline coordinate restatements that translate a variable name into prose (`// intersection of AB and CD`).
- Trivial parentheticals (`// (drawn behind edges)`).

New `.asy` files start with `import _common;` directly — no preamble. Math derivation comments are *verbose* — a one-line "law of cosines" pointer isn't useful; a block deriving the quadratic root choice is.

**Helpers in `_common.asy` and `<topic>-shared.asy`** use this docstring style: each parameter on its own line, framed `//` docstring above the function (verb-first, mention key params in prose, don't enumerate every param), "Used global variables:" line when the body relies on top-level constants.

```asy
//
// Fills the angle sector ∠XYZ with vertex Y, sweeping CCW from ray YX to ray YZ.
// Pass a `Light*` pen for `color` so the filled sector reads softly. When `lab`
// is non-empty, "$lab$" is placed on the angular bisector at distance
// labelFraction * radius + labelOffset from Y.
//
// Used global variables: Radius3, angleMarkLabelFraction
//
void AngleMark(
    pair X,
    pair Y,
    pair Z,
    pen color,
    string lab = "",
    real radius = Radius3,
    real labelFraction = angleMarkLabelFraction,
    real labelOffset = 0,
    pen labelPen = black)
{
    ...
}
```

Top-level constants get framed comments too — one frame per logical group or per standalone scalar. No trailing inline comments on the declaration line. No `//---` decorators.

## Gotchas

- **Asymptote strings — single backslash for LaTeX.** Only `\"` is escaped. Write `"\alpha"` (one backslash) for LaTeX — `"\\alpha"` renders a newline followed by the text "alpha":
  ```asy
  label("$\alpha$", (0, 0));    // ✓ α
  string lab = "\beta";
  label("$" + lab + "$", ...);  // ✓ β
  label("$\\gamma$", ...);      // ✗ newline + "gamma"
  ```
- **`include "<topic>-shared.asy";` must be quoted** — bare `include foo;` parses `foo` as an identifier and hyphens are illegal. `import _common;` works because `_common` is a valid identifier. (`import` uses module-style scoping; `include` is textual-paste, which is what shared modules want.)
- **Figure pairs that share geometry** → extract to `<topic>-shared.asy`:
  - Use the `-shared` suffix, not a `_` prefix (`_` is reserved for handout-wide modules like `_common.asy`; `-shared` sorts next to siblings).
  - `export-asy.sh` already skips both conventions — no further config needed.
  - Don't promote per-pair helpers into `_common.asy`. That file is for primitives; problem-specific configurations stay local.

## Rules

- **Never call `asy` directly for committed changes** — `export-asy.sh` is the canonical pipeline (asy-rendered SVG, `-cd` so `include` and `import` resolve, Ghostscript wired in via `LIBGS` for `patterns`/EPS figures).
- **Never inline `rgb(...)`, `fontsize(...)`, ad-hoc widths, or stray `opacity(...)`** — extend the palette in `_common.asy` if a missing shade is genuinely needed, but don't sprinkle one-offs.
- **Always use the `_common.asy` helpers — never raw `draw(...)`.** `Draw(A, B, pen)` for segments, `Circle(center, radius, pen)` for circles, `LabeledDot` / `VertexDot` for points. The global `defaultpen` carries `linewidth(NormalWidth)`, so any pen with its own `linewidth(...)` (e.g. `vertexPen`'s `ThinWidth`) still renders correctly through `Draw` — no raw `draw` for thin auxiliary lines. The only standing exceptions are `box.asy` (3D `draw(surface(...), ...)`) and `ag-proof.asy` (path-based draws with non-standard linewidths from SVG conversion).
- **Never edit `<topic>-shared.asy` to change a single figure's marks** — only geometry and `Base*` layers belong there.
