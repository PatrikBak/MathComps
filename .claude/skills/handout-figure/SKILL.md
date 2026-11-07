---
name: handout-figure
description: Use this skill when editing or adding handout figures — Asymptote `.asy` files in `data/handouts/Images/`. Adding/modifying geometry, angle marks, fills, colors, labels, then re-rendering to PDF + SVG. Trigger phrases — "add a 60° angle to that figure", "change the color in the figure", "redraw", "fix the figure", "make X visible", anything touching a `.asy` under handouts. Do NOT use for editing the `.tex` that embeds the figure — that's `handout-editor`.
---

# Handout Figure Editor

You edit Asymptote figures in `data/handouts/Images/`. Source is `.asy`; the `.svg` (website) is committed and must stay in sync with the source. The `.pdf` (handout PDF) is a build artifact — rendered locally, gitignored, regenerated on demand.

## Workflow

1. **Identify the figure.** The user may name the slug (e.g. `angles-pentagon`) or paste a `\Image{...}` line. The file is `data/handouts/Images/<slug>.asy`.
2. **Primitives in `_common.asy`**: `Draw`, `DashedDraw`, `DashDotDraw`, `DottedDraw`, `PatternDraw`, `Circle`, `Arc`, `AngleMark`, `RightAngleMark`, `LabeledDot`, `VertexDot`, `VertexDots`, `PointLabel`, `EdgeLabel`, `ParallelMark`, `EqualMark`, `EquilateralTriangle`, `Midpoint`, `Foot`, `ReflectAcross`, `Polar`, `ExtendPast`, `LineCircleIntersections`, `OtherIntersection`, `RadicalAxis`, `Circumcenter`, `Incenter`, `CircleThrough`, `TangentPointsFromExternal`, `CommonExternalTangent`, `CommonExternalTangentAwayFrom`, `CommonInternalTangent`. Read `_common.asy` only for a signature this skill doesn't document — and read the copy in **this** `Images/` directory, never one on Asymptote's global search path, which can lag this checkout; `export-asy.sh` passes `-cd`, so the local file is what actually compiles. Note `LineCircleIntersections` returns its two points **ordered along `A → B`**, so which one is "near" depends on the direction you passed. `EqualMark(A, B, count)` ticks the two collinear equal segments of *Palette and styling*; `ParallelMark` marks parallels only, never equality.
3. **Check for a shared module.** If `<topic>-shared.asy` exists, the figure is part of a statement/solution pair: geometry and base layers live in shared; individual files call `BaseFills() / BaseEdges() / BaseDots()` and add only their own marks. Never edit the shared file to change one figure's marks. Parametrising one (top-level constants into a `Setup(...)` whose defaults are those values) must leave every sibling's SVG byte-identical; check it as in the last rule under *Rules*.
4. **Re-render** from `data/handouts/Images/`:
   ```
   bash export-asy.sh <slug>.asy
   ```
   The script is committed non-executable, so `./export-asy.sh` fails with permission denied — always go through `bash`. Produces the PDF (local preview / handout compile) and the `asy`-rendered SVG. Never call `asy` directly for a committed change: the script passes `-cd` so `include`/`import` resolve and wires Ghostscript in via `LIBGS` for `patterns`/EPS figures. **Then recompile the handout** from `data/handouts/` (`pdfcsplain -interaction=nonstopmode -halt-on-error <handout>.<lang>.tex`): Patrik reads the PDF, and a re-rendered figure is invisible to him until it compiles again.
5. **Check the natural width** against the budget below — `grep -o "width='[0-9.]*pt'" <slug>.svg`.
6. **Look at the render**, at 300 DPI, never at natural size: `pdftoppm -r 300 -png <slug>.pdf <out>` and `Read` the PNG, or four per sheet with `magick a.png b.png c.png d.png -append` / `+append` to spare the session's image budget (`magick montage` and `-annotate` die here with `unable to read font ''`, and montage still writes a complete-looking file). A wrong-side wedge, a missing arm or circle, a label on a stroke: obvious in the image, invisible in the source. The render exit code only tells you the file compiled.
7. **Cap the render-look loop at two or three cycles.** Patrik reviews every figure himself and positions the labels, so fix what the look shows and stop. When agents draw the figures, the cap goes in each brief.
8. **Report** one sentence — what changed in the figure.

## Designing a figure from the argument

- **Design the proof figure after the proof is written, step by step.** List the steps, name the object each one needs (the mapped pair, the equal wedges, the auxiliary circle, the right angle), and draw exactly those on top of the statement's configuration. Mark only the angles and objects the argument uses, never an incidental angle or an unused right angle; a numeric degree label only when the value is the point. A figure that merely repeats the statement is there for the sake of being there.
- **Draw every object the text names, lines and circles included, not only points.** A point defined by a condition needs the condition visible: `AS ⊥ AT` needs both segments and the right-angle mark, a point on ray `ST` needs the stretch of `ST` that shows the order, a second intersection of two circles needs both circles. A label the text never names (`M_1`) is a defect too: name it in the text or drop it. When a proof paragraph names four circles and uses one, cut the names from the paragraph rather than crowd the frame; a statement's objects are never cut (see *Rules*).
- **Draw the statement's numbers as given.** A rhombus stated at $42^\circ$ is drawn at $42^\circ$, never at $66^\circ$ for a roomier picture; make room with size instead.
- **Reuse the statement's shared module and layout for the proof figure**, same points in the same places, so the reader recognizes the configuration; add only what the steps use and drop base objects the step never touches, never the ones defining a point it labels.
- **Labels are part of the shared base.** Put the shared points' labels in the module's `BaseDots`, and a helper such as `LabelO()` for a point only some frames draw, so one offset lands in every sibling. The exception is a point that moves between the module's configurations (`Setup(bool)`): an offset is written into the call, so one shared call would move both pictures' labels together, and that point gets one call per branch.
- **A transformation's source is green and its image red.** To colour part of a side, draw the black stretch and the coloured stretch as two segments; a coloured segment drawn under the black side vanishes.
- **A circle that dwarfs the part the proof works in becomes an `Arc` through its named points** with a buffer of about 12°, and the figure scales up. An inversion image may take any radius, so pick one that keeps it near the original.
- **Equal angles sharing a vertex never get two hues.** When two copies of a marked angle overlap in a fan of rays, split the fan into consecutive wedges so each copy is the same sequence of shades (green, yellow, green for two copies) and mark nothing else at that vertex. Never build such a fan to encode a chain of equalities the definition already states (five wedges at O saying ∠AOA' = ∠XOX' = ∠BOB'): that is a device, not a figure, and a frame that is the statement plus a device gets dropped.
- **Length labels on a thin triangle do not fit; leave them to the text.**
- **Audit an existing set mechanically first, then look.** Width and height from the SVG, ink density at 72 DPI, raw `draw(`/`fill(`, free-vector aligns, comment count, then sheets of six at 130 DPI (`+append` rows, `-append` the sheet). To check a whole handout for objects its figures omit, run `handout-review`'s figure sweep.

## Figure size — the phone budget

A figure's physical size *is* the magnitude of its coordinates (`unitsize(1pt)`, no `size()` clamp), while pens and fonts are absolute. Nothing downstream rescales it up: **a figure shrinks on a narrow screen but never grows**, and there is no tap-to-zoom. The phone is the binding constraint for a statement figure, never print.

- **185pt wide (≈246px) is the widest figure that never downscales in a theorem card**, even on a 320px phone; a hint or solution panel there is 159pt (≈212px). A sparse figure stays under it.
- **Size by density, not by role.** Three to five points next to a short statement: 90–120pt tall, past ~140pt needs a reason. A dense configuration (two circles, six or more points) runs to ~200pt wide and ~180pt tall wherever it sits, theorem or solution. The phone shrink past 185pt (about 8% in a theorem card, 20% in a hint or solution panel on a 320px phone) is an accepted cost; a cramped drawing is not.
- **A circle-dominated figure is roughly as tall as it is wide, so sizing it by width is the trap.** Hitting the statement-figure height target puts such figures at ~110–150pt wide — deliberately under the width band, and correct. Wide-and-short figures (a triangle, a point-and-secant layout) can use the full width.
- **Before shrinking a figure, find what actually sets its bounding box.** One drawn circle often *is* the box, and shrinking the free parameter that inflates that circle shrinks the figure while every named point stays put, where a uniform scale-down spends the clearance the figure was enlarged for.
- **Keep a handout's figures within a narrow band**, banded on whichever dimension dominates them. Below roughly 100pt across, 13pt labels start to dominate whatever the shape.
- **Never pass `\Image` a `scale` argument to shrink a too-wide figure.** Scale multiplies the max-width, so it makes the phone case worse. Author at the target size instead.
- **Ink density catches "too big" that width alone misses.** Non-white share of the box at 72 DPI: `pdftoppm -r 72 -png -singlefile <slug>.pdf out` then `magick out.png -colorspace Gray -threshold 78% -negate -format "%[fx:mean*100]" info:`. Aim for 6 to 8 percent. At 3 to 4 the figure is too big for its content, even with its width in band; one at its size ceiling runs 8 to 10.

Measured viewport widths and the arithmetic behind these numbers: [figure-sizing.md](figure-sizing.md).

**Never use `pattern()` / `HatchedFill`.** It forces Ghostscript rasterization of the whole figure, so the SVG becomes one embedded JPEG (`equal-tangents-checkerboard.svg`) instead of paths. Use a `Light*` fill instead.

## Source layout

- **Parametrize coordinates.** Extract numeric coordinates into top-level `real` constants at the top of the file, then build `pair`s from them — don't hard-code numbers inside `pair` declarations. Example: instead of `pair A = (-90, 0); pair B = (90, 0); pair X = (-120, 120);`, write
  ```asy
  real halfBase = 90;
  real apexHeight = 120;
  pair A = (-halfBase, 0);
  pair B = (halfBase, 0);
  pair X = (-halfBase - 30, apexHeight);
  ```
  Retuning the figure is then a one-constant edit; geometry intent reads from the names. Work at ~100-unit coordinates: `AngleMark` radii, `RightAngleMark` sizes and label offsets are absolute, so a unit-circle figure has marks that dwarf it. If marks look huge, scale the coordinates up, never shrink the marks. Established pattern — `angles-pentagon.asy` (`real alpha, lenBC, lenDE`), `angles-isosceles-triangle.asy` (`real base, height`), `angles-circumcenter.asy` (`real R, pastMidpoint, pastO`).
- **When a derived point lands wherever the geometry puts it** (a second intersection, a spiral centre), **search the free coordinates with a throwaway script before writing the `.asy`**. Score every candidate by its smallest clearance (every named point to every other named point, and to every stroke it does not lie on) and MAXIMIZE that, with the box-size budget as the constraint. A search that floors spacing and optimises the box stops at the floor. Aim for 25pt of clearance; treat 15pt as the hard floor. **Constrain the search away from regularity**: maximising the smallest clearance favours the most symmetric configuration, so a cyclic quadrilateral comes back near-square and a triangle near-equilateral, which reads as a hypothesis the theorem does not have. Add a spread constraint (no two arcs, angles or lengths within a few degrees of each other).
- **When several figures share one `<topic>-shared.asy` module, search its free parameters jointly for the worst sibling, never per figure.** Tuning one figure can leave a sibling cramped or missing what it needs, and the fix is never to drop what the statement names. If no configuration in the current layout family clears the floor for every sibling, change the family (e.g. rays from a shared apex instead of a quadrilateral).
- **Naming.** Prefer names that encode geometric role (`R`, `alpha`, `lenBC`, `pastO`, `bisectorLeft`, `Xprime`) over generic `x/y` or code-style abbreviations (`bis`, `aux`, `ext`, `eR`, `iZ`). Math-language names are fine — single-letter symbols (`R`), Greek words spelled out (`alpha`), compound math nouns (`lenBC`, `pastO`) — but clipped English reads like a half-deleted variable name. Bare `x/y` is acceptable only when the figure is genuinely Cartesian.
- **Never put prose in a figure — labels are math symbols only.** The Handouts CLI uploads SVGs to `handouts/<slug>/<image>.svg` with the slug **language-stripped**, so every language variant shares one image set and there is no per-language override: a Slovak caption renders verbatim in the EN and CS variants. If a figure genuinely needs a caption, put it in the `.tex` between two `\Image` calls, where it translates.
- **Use compass constants for label alignment.** `LabeledDot(A, "A", S)` not `LabeledDot(A, "A", (0, -1))`. The compass set is `N`, `S`, `E`, `W`, `NE`, `NW`, `SE`, `SW`. **Exception:** when a point variable shadows a compass letter (e.g. pentagon vertex `E` shadows east), pass an explicit vector for that one label: `LabeledDot(E, "E", (1, 0))`. A shadowed letter aims the label along the point's own coordinates, at whatever angle they lie from the origin, and pushes it about 4pt further per unit of their length: usually a box that suddenly grows, but silent for a point near the origin, and a point at the origin turns `distanceOffset` off entirely, so a label that won't budge is this first. So adding a `pair` named after a compass letter changes every label in that file that uses the letter: grep the file for it.
- **Place each label once, then stop: Patrik positions them himself**, writing an `offset` into each call. Give each label a compass direction into the open side of its dot, close to it (`distanceOffset` 0 to 1 on a diagonal, 2 to 3 on an axis), with `halo = true` where a stroke runs under it. Every label goes through `LabeledDot`, `PointLabel`, `EdgeLabel` or `AngleMark`, one call per label and none inside a loop, since his offsets attach to the call: a raw `label()` cannot be positioned, and labels from one loop line move together.

## Palette and styling

- **Hue families × 3 shades** in `_common.asy`: `LightBlue/Blue/DarkBlue`, `LightRed/Red/DarkRed`, `LightGreen/Green/DarkGreen`, `LightPurple/Purple/DarkPurple`, `LightPink/Pink/DarkPink`, `LightYellow/Yellow/DarkYellow`, `LightOrange/Orange/DarkOrange`. Always pick a named pen — never inline `rgb(...)`; a genuinely missing shade gets added to `_common.asy`, not sprinkled as a one-off.
- **Circles that come in pairs get one `Light*` hue per pair, of equal weight**: `LightPurple` with `LightOrange`. Four circles in one `LightBlue` read as a tangle, and `LightGreen` and `LightYellow` are far paler than the rest, so next to any other hue either reads as the lesser pair.
- **`AngleMark` / `RightAngleMark` take a `Light*` pen** — they fill a sector with no edge stroke, so a saturated pen reads heavy. For `labelPen` use a Normal/Dark pen or a `Font*` tier (e.g. `AngleMark(C, B, A, LightRed, "\alpha", labelPen = Red)`, `labelPen = Font2`).
- **`AngleMark(X, Y, Z, color, ...)` — vertex is the MIDDLE arg, sweep is CCW from ray YX to ray YZ.** It does NOT auto-pick the smaller side (`while (d2 < d1) d2 += 360`). If the wedge fills the long way around, swap to `AngleMark(Z, Y, X, ...)` to reverse direction.
- **`RightAngleMark(A, O, B, ...)` is the opposite: orientation-independent.** It always marks the corner between rays OA and OB, so swapping `A`/`B` renders the identical L. Don't try to flip it. Its signature is also `(A, O, B, radius, color, filled)` — `color` is the FIFTH argument, after `radius`, not the fourth as in `AngleMark`.
- **Nested wedges sharing a vertex** (e.g. ∠YAB inside ∠XAB at A): draw the outer FIRST at the larger radius, then the inner, in two different warm `Light*` hues at `+ opacity(0.8)` so the overlap shows (`LightOrange` outer, `LightRed` inner). One hue in two shades reads odd next to same-hue labels.
- **Paired equal-angle wedges meeting at a bisector ray** (e.g. ∠XAZ and ∠ZAY where AZ bisects ∠XAY): two wedges at the same radius merge into one arc cut by the bisector. Pass plain `Radius*` to the first AngleMark and the matching `Radius*Nudged` to the second — it scales the outer wedge by `WedgeNudge` so the pair stair-steps at the bisector. Established pattern: `angles-bisector-definition.asy`, `angles-bisectors-perpendicular.asy`.
- **Line widths**: three tiers — `ThinWidth = 0.5`, `NormalWidth = 1.0`, `ThickWidth = 1.5`. `Draw`/`Circle` apply `NormalWidth` automatically; `vertexPen` uses `ThinWidth`.
- **Font tiers**: `Font1..Font5` (8 / 10 / 13 / 16 / 20 pt). `Font3` is the default. Pass a smaller tier via `labelPen` for a narrow sector's angle label; a dense figure gets bigger, not smaller type.
- **Mark equal segments by colour, not ticks.** Each set of equal segments gets its own saturated hue (`Draw(A, B, Red)`, `Draw(C, D, Green)`), never one already meaning something in the figure. The exception is two collinear equal segments sharing an endpoint (a midpoint's halves), where one colour reads as a single segment: those take `EqualMark` ticks.
- **A shade shared by two angle marks says they are equal, in both directions.** The equal pair a step turns on takes one `Light*` shade, both arms drawn; an unequal pair (a central angle and its inscribed half) never does. A directed-angle proof (mod 180°) names pairs that can be supplementary in the drawing, so compute the undirected angles before giving two wedges one shade; when the proof's pair is the supplementary one, cite the other circle in the proof rather than mark a lie.
- **Two equal-angle pairs at one vertex**, each from its own isosceles triangle, their wedges overlapping partway: one `Light*` hue per pair with `+ opacity(0.5)`, and one radius per pair, the same at both of its vertices and different from the other pair's (`AngleMark(Q, P, S, LightBlue + opacity(0.5), radius = Radius3)` with its twin at S, the green pair at `Radius2`), so the marks pair up by size as well as by hue. Nothing else at that vertex: no `?` on the asked angle, no letter on an angle the figure is not about, and no colour or ticks on the equal segments the pairs come from, since the angles already say it.
- **Two right angles overlapping at one vertex** (∠BAD and ∠CAE sharing the wedge between AC and AD): filled `RightAngleMark` squares with `+ opacity(0.45)`, a colour each, at close but different radii (18 and 22), never outlined squares crossing each other.
- **Opacity is forbidden** except for genuinely overlapping translucent fills (nested wedges, overlapping angle pairs, two filled regions where the overlap should read deeper). For non-overlapping fills, pick a different `Light*` shade.

## Layout conventions

- **Triangle $ABC$**: $A$ at the top, side $BC$ horizontal along the bottom; vertices labeled counter-clockwise ($A$ top, $B$ bottom-left, $C$ bottom-right). For a scalene triangle place $A$ slightly off the vertical axis (e.g. `dir(100)` instead of `dir(90)`) so the figure isn't symmetric. Every free parameter stays off its special case the same way: a quadrilateral with perpendicular diagonals drawn as a square reads as the case where the result is obvious. With circumradius $R$ at the origin, `B = R*dir(180°+α)` and `C = R*dir(360°-α)` puts $BC$ on a horizontal line below the x-axis at the same $y$ for any $\alpha$. Never tilt $BC$ for a nicer bounding box.
- **Quadrilateral $ABCD$**: side $AB$ horizontal along the bottom, $A$ left, $B$ right, the rest above. Reorient a finished construction with `rotate(-degrees(B0 - A0))` on its base points. If the vertices come out clockwise, `reflect((0, 0), (1, 0))` first, then reverse the argument order of every `AngleMark`: a reflection flips its CCW sweep, and the wedges fill the long way round.

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
- **Why a label sits where it sits.** Measured clearances, which wedge was widest, why one takes a `halo`: the choice is already the code. A geometric relation the drawing must satisfy stays (*"the two wedges at Y share ray YM"*); a number in points goes.
- **How a coordinate was searched.** What the search maximised, what the previous layout scored, what the box came to.
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
- **Default to one big figure per solution; split only when one frame cannot hold both stages at ~200pt.** A second frame that adds one circle and a right angle to the first is oversplit; merge it back. The test is whether the two frames READ as the same picture, not whether one is a strict subset: a pair sharing its whole base and differing only in what each adds is oversplit too. The usual cause is a frame carrying content for a later stage, so re-dividing beats merging: cut from frame 1 everything the prose before frame 2 never uses. When a pair is genuine, extract the shared geometry to `<topic>-shared.asy`:
  - Use the `-shared` suffix, not a `_` prefix (`_` is reserved for handout-wide modules like `_common.asy`; `-shared` sorts next to siblings).
  - `export-asy.sh` already skips both conventions — no further config needed.
  - Don't promote per-pair helpers into `_common.asy`. That file is for primitives; problem-specific configurations stay local.

## Rules

- **Always use the `_common.asy` helpers — never raw `draw(...)`.** `Draw(A, B, pen)` for segments, `Circle(center, radius, pen)` for circles, `LabeledDot` / `VertexDot` for points. The global `defaultpen` carries `linewidth(NormalWidth)`, so any pen with its own `linewidth(...)` (e.g. `vertexPen`'s `ThinWidth`) still renders correctly through `Draw` — no raw `draw` for thin auxiliary lines. The only standing exceptions are `box.asy` (3D `draw(surface(...), ...)`) and `ag-proof.asy` (path-based draws with non-standard linewidths from SVG conversion).
- **Draw every object the statement names, even where the argument never uses it.** A quadrilateral missing two sides is not a quadrilateral. The segments a solution step needs are a floor, not a ceiling.
- **Every angle the text uses has both arms drawn**, a marked one (`AngleMark`, `RightAngleMark`) and one the prose only chases (`|\angle XYZ|`, `\angle(XY, ZW)`) alike: an angle between a side and an undrawn ray is invisible. Draw an auxiliary arm thin (`Draw(M, A, vertexPen)`), a load-bearing one at full width, or drop the mark. Before handing over a proof figure, list the angles in its paragraphs and find each arm in the `.asy`.
- **A `_common.asy` edit that changes existing figures needs `--force-asy`** on the next CLI build — the CLI keeps that file out of its staleness graph and otherwise reports every figure fresh. Adding a new helper is exempt; a palette shade or a modified primitive is not.
- **Prove a library or shared-module refactor changed nothing by re-rendering every affected figure and diffing the SVGs.** `export-asy.sh` is deterministic, so a byte-identical `.svg` is proof; copy them aside first, since the render overwrites in place. Never compare the PDFs: they carry a creation date and always differ.
