# Figure sizing — the measurements behind the budget

Evidence for the size rules in `SKILL.md`. Read this only when a rule looks wrong for the figure in front of you, or when the rendering pipeline changes.

## Why a figure can only shrink

`_common.asy` sets `unitsize(1pt)` and no `size()` clamp, so a figure's physical size *is* the magnitude of its coordinates. Pens and fonts are absolute: `defaultpen(fontsize(13pt) + linewidth(1.0))`.

Nothing downstream scales it up. `\Image` places at natural size in the PDF, and on the web `ImageWithLoader` sets `max-width: naturalWidthPt × 4/3 px` with `width: 100%`. There is no tap-to-zoom, no max-height, and no horizontal scroll for images, so a figure forced to shrink just stays small, with its labels below body-text size.

## Measured column widths on a phone

| viewport | inside a theorem card | inside a hint/solution disclosure |
| --- | --- | --- |
| 390px | 316px | 282px |
| 360px | 286px | 252px |
| 320px | 246px | 212px |

The 185pt width cap is the 320px disclosure column (246px ÷ 4/3 = 184.5pt). Anything at or under it never downscales anywhere.

## Why height is the binding constraint in practice

Width only decides whether the figure downscales. Height decides how big a bite it takes out of the page next to a one- or two-line statement. A 169×95pt figure reads as correctly sized; a 160×172pt one next to the same statement reads as "insane whitespace", even though both sit inside the width band.

## Why the label ratio sets a floor

Because fonts and pens are absolute, halving a figure's size doubles the label-to-drawing ratio. Across one handout, `equal-tangents` spans 95pt to 193pt: at the small end (`pitot`, 127px on screen) labels are ~14% of figure width and it reads as mostly-labels, versus ~7% at the large end.

## Print is never the constraint

`\hsize` is 452.97pt, and inside a `\Theorem`'s `\leftbar` the column is ≈431.5pt. Every figure that fits the phone budget fits print with room to spare.
