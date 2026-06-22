---
name: extract-figures
description: Use this skill to pull figures out of a vector competition PDF as small, faithful SVGs for the bulk-import pipeline — auto-detecting each diagram, cropping it (keeping the real glyph outlines, not retypeset text), and rendering a PNG preview of every crop to verify. Trigger phrases: "extract the figures from this PDF", "crop the diagrams out of a competition PDF as SVGs", "get the figure for problem N", "I need the images from this competition PDF". Hands the cropped SVGs to the add-problems skill for placement. Do NOT use for raster/scanned PDFs (it only handles vector drawings), or for handling problem text.
---

# Extract figures (PDF → small SVGs)

Turn the diagrams in a **vector** competition PDF into small, faithful `.svg` files plus PNG previews, so figures can be wired into a bulk-import draft. **Done = every emitted figure has been eyeballed in its PNG preview and confirmed complete and correct.** This skill produces assets only; placing them into a draft is the [add-problems](../add-problems/SKILL.md) skill's job.

The hard discovery work is already baked into the bundled script — do not re-derive it. Just run, review, place.

## Run

```sh
# self-contained — the script declares its deps inline (PEP 723), so uv fetches PyMuPDF itself, no venv:
uv run .claude/skills/extract-figures/extract_figures.py INPUT.pdf OUTDIR
```

Writes into `OUTDIR`: `fig-p<page>-<x>-<y>.svg` (named by the box's top-left corner), a matching `.png` preview for each, and `figures.json` (manifest: page, bbox, label text, byte size). A re-run clears the prior `fig-p*` outputs first, so the directory always matches the latest `figures.json`. Sizes are typically 10–40 KB. Add `--no-preview` to skip PNGs (don't — the previews are the verification). Detection thresholds are flags (`--gap`, `--min-side`, `--row-gap`, …); a plain run uses the tuned defaults, so reach for them only when a paper's layout systematically defeats the defaults (see *Review*).

## Review (mandatory — the heuristics are tuned, not bulletproof)

Open every `.png`. For each, confirm: the geometry is **complete** (no missing lines), the **labels are correct** (they're the real PDF glyph outlines, so they should be), and nothing extra was dragged in. Then map each figure to its problem using `figures.json`: the `page` and the `labels` string (e.g. `"AXTS′PMCBQP"` → the geometry problem whose points are A,B,C,P,Q,X,…; `"4i+2 4n+6 …"` → the indexed-sequence problem).

Known failure modes to watch for, and the fix (re-run with the flag):
- **A real figure is missing entirely** — most often it fell under the size threshold (lower `--min-side` / `--min-prims`), or it merged into a neighbour (lower `--gap`). A drawing built from *only* horizontal strokes (no verticals, diagonals, or curves) is also dropped as an equation — pass `--keep-equation-shapes` for that run. (A grid has verticals, so it is never filtered this way.)
- **A non-figure slipped in** (an equation block) — usually a √-heavy or boxed equation whose strokes aren't purely horizontal. Just delete its SVG.
- **One figure split into pieces** — raise `--row-gap` (horizontal sequence) or `--gap` (clustering).
- **A label is clipped, or prose got pulled in** — adjust `--label-probe` / `--label-max` / `--label-cap`.

All knobs are CLI flags that default to Czech-MO-tuned values — run with `-h` to list them, and override per-PDF instead of editing the script.

## How it works (so the knobs make sense)

Per page: cluster the vector drawing primitives → drop clusters whose strokes are **only horizontal rules** (fraction bars = equations, not figures) → **row-merge** same-band clusters so a "cell 1 … cell n" ellipsis sequence is one figure → expand the box by **short, close** tokens only (point labels/indices, never a line of prose, bounded by `--label-cap`) → crop by pruning the page's `text_as_path` SVG to the in-box **drawing paths** (transform-aware bbox) plus the **glyph `<path>`s** its labels reference. Keeping the actual glyph outlines is why labels are faithful; dropping the rest of the font dictionary is why the files are small. Previews are rendered by re-opening each emitted SVG, so they show exactly what was produced.

## Then place the figures

Hand off to [add-problems](../add-problems/SKILL.md): copy the chosen `.svg` into the draft's `images/`, reference it as `![alt](images/<name>.svg)` in the original-language `pN.md` at the right spot (per the house rule: a closing question rides on the last text paragraph, but a figure is its own block — the question follows the figure), and keep the `![alt](images/…)` **byte-identical** across all language files. The figure is language-neutral (no `<text>` nodes; labels are outlines), so one SVG serves every translation.

## Notes

- Vector PDFs only — `get_drawings()` finds nothing in a scanned/raster PDF (the run prints "none found").
- This is the automated cousin of the **SvgSelect** app (manual PDF-region cropping).
- Faithful-but-imperfect by design: the render-verify loop is the reliability, not the heuristics. Always look at the previews before trusting a crop.
- The path/bbox parsing is the one subtle part — after editing the detection or cropping logic, re-run the tests: `uv run .claude/skills/extract-figures/test_extract_figures.py`.
