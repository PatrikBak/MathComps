#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["pymupdf>=1.27,<2"]
# ///
"""Extract figures from a (vector) competition PDF as small, faithful SVGs.

Pipeline, per page:
  1. cluster the vector drawing primitives into candidate regions;
  2. drop equation/fraction-bar blocks (clusters whose strokes are ONLY
     horizontal rules — real figures have diagonals, curves, verticals or rects);
  3. row-merge horizontally-spaced clusters on the same band (so a "cell-1 ...
     cell-n" sequence with an ellipsis comes out as one figure);
  4. expand each box by nearby SHORT tokens (point labels / indices), bounded so
     it can't swallow a line of statement prose;
  5. crop by pruning the page's text-as-path SVG down to just the in-region
     drawing paths (transform-aware) plus the glyph outlines its labels
     reference — keeping the REAL glyphs, not retypeset text.

A PNG preview of every emitted SVG is rendered so the output can be eyeballed.
The detection heuristics are tuned, not bulletproof — ALWAYS review the previews
(a tiny figure can fall under the size threshold; a sqrt-heavy or boxed equation
can slip through as a figure).

Boxes throughout are [x0, y0, x1, y1] in PDF points (y grows downward); a cluster
box carries a trailing primitive count as a fifth element.

Usage:
    uv run extract_figures.py INPUT.pdf OUTDIR [--no-preview]   # uv reads the inline deps above

Detection thresholds (--gap, --min-side, --row-gap, --label-cap, …) default to
values tuned for Czech MO PDFs; run with -h to list them. Override per-PDF when a
paper's layout doesn't fit the defaults, rather than editing the defaults here.

Outputs into OUTDIR: fig-p<page>-<x>-<y>.svg, matching .png previews, and
figures.json (manifest: page, bbox, label text, byte size).
"""

from __future__ import annotations

import argparse
import glob
import html
import json
import os
import re
import sys
from dataclasses import dataclass

import pymupdf


@dataclass(frozen=True)
class Knobs:
    """Detection thresholds — defaults fit Czech MO statement PDFs; override per-PDF via CLI flags."""

    gap: float = 16  # max gap (pt) to cluster two drawing primitives together
    min_side: float = 22  # a figure must be at least this wide AND tall (pt)
    min_prims: int = 3  # ...and contain at least this many drawing primitives
    row_gap: float = 120  # row-merge: max horizontal gap (pt) between same-band clusters
    row_yov: float = 0.5  # row-merge: min vertical-overlap fraction
    label_probe: float = 7  # include label tokens within this distance (pt) of the drawings
    label_max: int = 6  # ...whose trimmed text is at most this many chars (labels, not prose)
    label_cap: float = 16  # ...but never expand the box more than this far (pt) past the drawings
    margin: float = 4  # final breathing room (pt) around the box
    keep_equation_shapes: bool = False  # keep all-horizontal clusters instead of dropping them as equations


# The default thresholds, reused as the CLI flag defaults
DEFAULTS = Knobs()

# Matches any number in SVG path / transform data: .1, 3455.39, -.1, 0, 1e-3
NUMBER_RE = re.compile(r"-?\d*\.?\d+(?:[eE][-+]?\d+)?")
# A path's `d` attribute splits into command letters and those same numbers
PATH_TOKEN_RE = re.compile(r"[A-Za-z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?")
# How many numbers each SVG path command consumes per step
PATH_ARITY = {"M": 2, "L": 2, "H": 1, "V": 1, "C": 6, "S": 4, "Q": 4, "T": 2, "A": 7, "Z": 0}


def _near(box_a, box_b, gap):
    """Whether two boxes lie within `gap` points of each other (overlap counts as near)."""
    # Near unless one box clears the other on some axis by more than gap
    return not (
        box_a[2] + gap < box_b[0] or box_b[2] + gap < box_a[0] or box_a[3] + gap < box_b[1] or box_b[3] + gap < box_a[1]
    )


def _union(box_a, box_b):
    """The smallest box enclosing both inputs."""
    # Outer extent on every side
    return [min(box_a[0], box_b[0]), min(box_a[1], box_b[1]), max(box_a[2], box_b[2]), max(box_a[3], box_b[3])]


def _intersect(box_a, box_b):
    """The overlapping box of the two (comes out inverted when they don't overlap)."""
    # Inner extent on every side
    return [max(box_a[0], box_b[0]), max(box_a[1], box_b[1]), min(box_a[2], box_b[2]), min(box_a[3], box_b[3])]


def _y_overlap(box_a, box_b):
    """Vertical-overlap fraction of two boxes (0 when disjoint)."""
    # Height of the shared vertical band
    overlap = max(0, min(box_a[3], box_b[3]) - max(box_a[1], box_b[1]))
    # Height of the shorter box, the denominator
    shorter_height = min(box_a[3] - box_a[1], box_b[3] - box_b[1])
    # Fraction of the shorter box that overlaps (guard a zero-height box)
    return overlap / shorter_height if shorter_height > 0 else 0


def _merge(items, cond):
    """Greedily cluster boxes: union any pair the predicate accepts, repeating until none merge.

    Each box is [x0, y0, x1, y1, count]; the trailing primitive count sums on union.
    Returns the merged box list.
    """
    # Re-sweep the whole list until a pass makes no further union
    changed = True
    while changed:
        changed = False
        out = []
        # Drain the working list, growing one seed box at a time
        while items:
            # Take a seed and try to absorb everything it touches
            box = items.pop()
            grew = True
            # Keep absorbing while the last sweep added something
            while grew:
                grew = False
                rest = []
                # Test the seed against every remaining box
                for other in items:
                    # Mergeable -> fold it in and sum the primitive counts
                    if cond(box, other):
                        box = _union(box[:4], other[:4]) + [box[4] + other[4]]
                        grew = changed = True
                    # Otherwise keep it for the next sweep
                    else:
                        rest.append(other)
                # Only the un-absorbed boxes survive to retry against the grown seed
                items = rest
            # The fully-grown seed is done
            out.append(box)
        # Feed the grown boxes back in for another whole pass
        items = out
    # No pair merged on the final pass
    return items


def _shape_kinds(drawings, box):
    """How many drawing strokes inside box run non-horizontal (curves, diagonals, verticals, rects).

    A figure carries curves / diagonals / verticals / rects; an equation block's
    drawings are purely horizontal fraction bars, so a zero count marks an equation.
    """
    # Tally the non-horizontal strokes inside the box
    non_horizontal = 0
    # Scan every drawing on the page
    for drawing in drawings:
        # Skip drawings whose bbox falls outside the region
        rect = drawing["rect"]
        if not _near([rect.x0, rect.y0, rect.x1, rect.y1], box, 0):
            continue
        # Classify each primitive stroke of the in-box drawing
        for item in drawing["items"]:
            # Read the primitive's op code
            op_code = item[0]
            # Curves, rects and quads are inherently non-horizontal
            if op_code in ("c", "re", "qu"):
                non_horizontal += 1
            # A straight line counts once it has real vertical rise
            elif op_code == "l":
                delta_y = abs(item[2].y - item[1].y)
                # A flat fraction bar has ~zero rise; anything taller is non-horizontal
                if delta_y > 3:
                    non_horizontal += 1
    # The count drives the equation-vs-figure decision
    return non_horizontal


def figure_boxes(page, drawings, knobs):
    """The label-aware bounding boxes of the figures on a page, under the given detection thresholds."""
    # Seed one box per drawing, tagged with its primitive count
    rects = [
        [drawing["rect"].x0, drawing["rect"].y0, drawing["rect"].x1, drawing["rect"].y1, len(drawing["items"])]
        for drawing in drawings
    ]
    # Cluster drawings that sit within the cluster gap of each other
    rects = _merge(rects, lambda first, second: _near(first[:4], second[:4], knobs.gap))

    # Keep only clusters big enough and shaped like a figure
    figures = []
    for box in rects:
        # Too small or too few primitives -> not a figure
        if (box[2] - box[0]) < knobs.min_side or (box[3] - box[1]) < knobs.min_side or box[4] < knobs.min_prims:
            continue
        # Only horizontal rules -> equation / fraction bars, dropped unless we keep them
        if not knobs.keep_equation_shapes and _shape_kinds(drawings, box[:4]) == 0:
            continue
        figures.append(box)

    # Row-merge same-band clusters so an ellipsis sequence becomes one figure
    figures = _merge(
        figures,
        lambda first, second: (
            _y_overlap(first, second) > knobs.row_yov
            and (max(first[0], second[0]) - min(first[2], second[2])) < knobs.row_gap
        ),
    )

    # Grow each figure box by the short label tokens hugging it
    words = page.get_text("words")
    boxes = []
    for box in figures:
        # The bare drawing box, before any label expansion
        drawing_box = box[:4]
        # Hard ceiling on how far labels may push the box out
        cap_box = [
            drawing_box[0] - knobs.label_cap,
            drawing_box[1] - knobs.label_cap,
            drawing_box[2] + knobs.label_cap,
            drawing_box[3] + knobs.label_cap,
        ]
        # The band just outside the drawings where labels live
        probe_box = [
            drawing_box[0] - knobs.label_probe,
            drawing_box[1] - knobs.label_probe,
            drawing_box[2] + knobs.label_probe,
            drawing_box[3] + knobs.label_probe,
        ]
        # Start from the drawing box and absorb qualifying label words
        label_box = drawing_box[:]
        for word in words:
            # A short token touching the probe band is a label, not prose
            if len(word[4].strip()) <= knobs.label_max and _near(word[:4], probe_box, 0):
                label_box = _union(label_box, word[:4])
        # Clamp the grown box back inside the cap
        label_box = _intersect(label_box, cap_box)
        # Add breathing room and clamp to the page bounds
        page_box = page.rect
        boxes.append(
            [
                max(label_box[0] - knobs.margin, page_box.x0),
                max(label_box[1] - knobs.margin, page_box.y0),
                min(label_box[2] + knobs.margin, page_box.x1),
                min(label_box[3] + knobs.margin, page_box.y1),
            ]
        )
    # One padded box per figure on the page
    return boxes


def _matrix(text):
    """The 6 coefficients of an SVG matrix(...) transform in `text` (identity tuple when absent)."""
    # Find the transform, if any
    match = re.search(r"matrix\(([^)]*)\)", text)
    # No transform -> identity
    if not match:
        return (1, 0, 0, 1, 0, 0)
    # Pull its numbers
    nums = [float(value) for value in NUMBER_RE.findall(match.group(1))]
    # The first six are the affine transform
    return tuple(nums[:6])


def _path_points(path_data):
    """Every (x, y) point an SVG path visits, walked command-aware.

    Tracks the pen so a single-coordinate H (x only) or V (y only) can't desync x
    from y the way a naive even/odd split would. Curve control points come along
    too, which can only over-estimate the bbox — fine for a crop test.
    """
    # Split the `d` data into command letters and numbers
    tokens = PATH_TOKEN_RE.findall(path_data)
    # The visited points, the running pen, and the current subpath start
    points = []
    pen_x = pen_y = start_x = start_y = 0.0
    # The active command and our cursor into the token stream
    command = ""
    cursor = 0
    # Walk the tokens one command-step at a time
    while cursor < len(tokens):
        # A letter switches command; a bare number repeats the previous one
        if tokens[cursor].isalpha():
            command = tokens[cursor]
            cursor += 1
        # Lowercase commands are relative to the current pen
        relative = command.islower()
        op = command.upper()
        # An unrecognized command can't be walked -> stop
        if op not in PATH_ARITY:
            break
        # How many numbers this step consumes
        arity = PATH_ARITY[op]
        # Grab this step's args
        args = [float(value) for value in tokens[cursor : cursor + arity]]
        cursor += arity
        # A short tail means a malformed command -> stop
        if len(args) < arity:
            break
        # Relative coords offset from the pen; absolute ones don't
        base_x = pen_x if relative else 0.0
        base_y = pen_y if relative else 0.0
        # Close returns the pen to the subpath start
        if op == "Z":
            pen_x, pen_y = start_x, start_y
        # Horizontal line carries an x only
        elif op == "H":
            pen_x = base_x + args[0]
        # Vertical line carries a y only
        elif op == "V":
            pen_y = base_y + args[0]
        # Arc: only its final pair lands on the path
        elif op == "A":
            pen_x, pen_y = base_x + args[5], base_y + args[6]
        # Everything else is (x, y) pairs, including curve control points
        else:
            # Record each pair the command introduces
            for offset in range(0, arity, 2):
                points.append((base_x + args[offset], base_y + args[offset + 1]))
            # The last pair becomes the new pen
            pen_x, pen_y = base_x + args[arity - 2], base_y + args[arity - 1]
            # A moveto also opens a new subpath
            if op == "M":
                start_x, start_y = pen_x, pen_y
            # The endpoint is already recorded
            continue
        # Record the pen for the single-point commands
        points.append((pen_x, pen_y))
    # Every point the path touches
    return points


def _element_bbox(element):
    """Page-space bbox of an SVG <path>, applying the path's own transform matrix."""
    # The path's affine transform, in SVG matrix(a,b,c,d,e,f) order
    scale_x, skew_y, skew_x, scale_y, translate_x, translate_y = _matrix(element)
    # The path geometry itself
    path_data_match = re.search(r'\bd="([^"]*)"', element)
    # No geometry -> no bbox
    if not path_data_match:
        return None
    # Walk the path into the points it visits
    points = _path_points(path_data_match.group(1))
    # No points -> no box
    if not points:
        return None
    # Map each point through the affine transform
    transformed_xs = [scale_x * point_x + skew_x * point_y + translate_x for point_x, point_y in points]
    transformed_ys = [skew_y * point_x + scale_y * point_y + translate_y for point_x, point_y in points]
    # The transformed bounding box
    return [min(transformed_xs), min(transformed_ys), max(transformed_xs), max(transformed_ys)]


def crop_svg(page, box):
    """Prune the page's text-as-path SVG down to just the figure in box.

    Returns (svg_string, label_text). Keeps the in-box drawing paths and the glyph
    <path>s referenced by in-box <use>s, dropping the rest of the font dictionary.
    """
    # Render the whole page as an SVG with text turned into glyph paths
    svg = page.get_svg_image(text_as_path=True)
    # The <defs> block holds the font's glyph outlines — absent on a text-free page
    defs_match = re.search(r"<defs>(.*?)</defs>", svg, re.DOTALL)
    # No <defs> means there's no glyph dictionary to index
    defs = defs_match.group(1) if defs_match else ""
    # Drawable content follows </defs>, or is the whole SVG when there's no <defs>
    content = svg[svg.index("</defs>") + len("</defs>") :] if defs_match else svg
    # Index every glyph outline by its id
    glyphs = {match.group(1): match.group(0) for match in re.finditer(r'<path id="(font_[^"]+)"[^>]*?/>', defs)}

    # Collect the in-box glyph placements, the in-box drawing paths, the needed glyph ids, and label text
    kept_uses, kept_paths, needed, labels = [], [], set(), []
    # A <use> places a glyph at its matrix's translation point
    for use in re.findall(r"<use\b[^>]*?/>", content):
        # Only the translate component positions the glyph
        *_, translate_x, translate_y = _matrix(use)
        # Skip placements that fall outside the figure box
        if not (box[0] <= translate_x <= box[2] and box[1] <= translate_y <= box[3]):
            continue
        # Find the glyph outline it references
        href_match = re.search(r'href="#([^"]+)"', use)
        # A placement with no resolvable glyph isn't useful
        if not href_match:
            continue
        # Keep the placement
        kept_uses.append(use)
        # Remember which glyph outline it needs
        needed.add(href_match.group(1))
        # Capture its source character for the label string (un-escaping any &lt;/&amp;)
        data_text_match = re.search(r'data-text="([^"]*)"', use)
        if data_text_match:
            labels.append((translate_x, translate_y, html.unescape(data_text_match.group(1))))
    # Keep the drawing paths whose bbox falls inside the figure box
    for path in re.findall(r"<path\b[^>]*?/>", content):
        # Skip the glyph-outline paths from the font dictionary
        if 'id="font_' in path:
            continue
        # In-box drawing paths are part of the figure
        path_bbox = _element_bbox(path)
        if path_bbox and _near(path_bbox, box, 0):
            kept_paths.append(path)

    # Pull just the glyph outlines the kept <use>s reference, in a stable order for reproducible output
    kept_glyphs = "".join(glyphs[glyph_id] for glyph_id in sorted(needed) if glyph_id in glyphs)
    # The box becomes the SVG's viewBox and its intrinsic size
    origin_x, origin_y, width, height = box[0], box[1], box[2] - box[0], box[3] - box[1]
    # Assemble a minimal standalone SVG: kept glyphs in defs, then drawing paths, then placements
    out = (
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'viewBox="{origin_x:.2f} {origin_y:.2f} {width:.2f} {height:.2f}" width="{width:.2f}" height="{height:.2f}">'
        f"<defs>{kept_glyphs}</defs>{''.join(kept_paths)}{''.join(kept_uses)}</svg>"
    )
    # Reading order: top-to-bottom (quantized into ~6pt bands so a row stays together), then left-to-right
    labels.sort(key=lambda label: (round(label[1] / 6), label[0]))
    # The SVG plus its labels concatenated in reading order
    return out, "".join(label[2] for label in labels)


def main():
    """CLI entry point: walk the PDF's pages, emit an SVG (+ PNG preview) per figure, and write the manifest."""
    # Parse the PDF path, the output dir, and the preview toggle
    parser = argparse.ArgumentParser(description="Extract figures from a vector PDF as small SVGs.")
    parser.add_argument("pdf")
    parser.add_argument("outdir")
    parser.add_argument("--no-preview", action="store_true", help="skip rendering PNG previews")
    # Detection thresholds, each defaulting to its Czech-MO-tuned value
    parser.add_argument("--gap", type=float, default=DEFAULTS.gap, help="cluster gap (pt) between primitives")
    parser.add_argument("--min-side", type=float, default=DEFAULTS.min_side, help="min figure width AND height (pt)")
    parser.add_argument("--min-prims", type=int, default=DEFAULTS.min_prims, help="min drawing primitives per figure")
    parser.add_argument("--row-gap", type=float, default=DEFAULTS.row_gap, help="row-merge max horizontal gap (pt)")
    parser.add_argument("--row-yov", type=float, default=DEFAULTS.row_yov, help="row-merge min vertical overlap")
    parser.add_argument("--label-probe", type=float, default=DEFAULTS.label_probe, help="label probe band (pt)")
    parser.add_argument("--label-max", type=int, default=DEFAULTS.label_max, help="max label token length (chars)")
    parser.add_argument("--label-cap", type=float, default=DEFAULTS.label_cap, help="max label box expansion (pt)")
    parser.add_argument("--margin", type=float, default=DEFAULTS.margin, help="breathing room around the box (pt)")
    parser.add_argument("--keep-equation-shapes", action="store_true", help="keep all-horizontal clusters as figures")
    args = parser.parse_args()

    # Fold the CLI overrides onto the defaults into one immutable config
    knobs = Knobs(
        gap=args.gap,
        min_side=args.min_side,
        min_prims=args.min_prims,
        row_gap=args.row_gap,
        row_yov=args.row_yov,
        label_probe=args.label_probe,
        label_max=args.label_max,
        label_cap=args.label_cap,
        margin=args.margin,
        keep_equation_shapes=args.keep_equation_shapes,
    )

    # Open the source PDF first, so a bad path fails before we touch the output dir
    try:
        source = pymupdf.open(args.pdf)
    except (pymupdf.FileNotFoundError, pymupdf.FileDataError) as error:
        # A wrong path or a non-PDF is the one predictable user error — say so, don't traceback
        print(f"cannot open {args.pdf}: {error}", file=sys.stderr)
        return 1

    with source as doc:
        # Make sure the output directory exists
        os.makedirs(args.outdir, exist_ok=True)
        # Clear figures a previous run left here, so the dir matches this manifest
        stale_outputs = glob.glob(os.path.join(args.outdir, "fig-p*.svg"))
        stale_outputs += glob.glob(os.path.join(args.outdir, "fig-p*.png"))
        for stale in stale_outputs:
            os.remove(stale)

        # One manifest entry per emitted figure
        manifest = []
        # Walk every page by index
        for page_index in range(doc.page_count):
            # Grab the page
            page = doc[page_index]
            # Read its vector drawings
            drawings = page.get_drawings()
            # A page with no drawings can't hold a figure
            if not drawings:
                continue
            # Crop each detected figure box on the page
            for box in figure_boxes(page, drawings, knobs):
                # Name the file by page and the box's top-left corner (keeps stacked figures distinct)
                name = f"fig-p{page_index}-{int(box[0])}-{int(box[1])}"
                # Build the pruned SVG and its label string
                svg, labels = crop_svg(page, box)
                # Write the SVG
                svg_path = os.path.join(args.outdir, f"{name}.svg")
                with open(svg_path, "w", encoding="utf-8") as svg_file:
                    svg_file.write(svg)
                # Render a PNG preview (unless suppressed)
                if not args.no_preview:
                    # A pruned SVG PyMuPDF can't re-parse must not kill the run. The previous
                    # run's outputs are already deleted and figures.json isn't written until
                    # the loop finishes, so raising here would strand a half-written figure
                    # set next to the previous run's manifest.
                    try:
                        # Re-open exactly what we wrote, so the preview shows the real output
                        preview = pymupdf.open(stream=svg.encode(), filetype="svg")

                        # 3x so ~6pt label glyphs stay legible on a crop only ~100pt wide
                        pixmap = preview.get_page_pixmap(0, matrix=pymupdf.Matrix(3, 3), alpha=False)

                        # Save the preview beside its SVG
                        pixmap.save(os.path.join(args.outdir, f"{name}.png"))

                        # Release the in-memory document
                        preview.close()
                    except Exception as error:
                        # Warn and carry on — the SVG itself is already written
                        print(f"warning: no preview for {name}.svg ({error})", file=sys.stderr)
                # Record the figure in the manifest
                manifest.append(
                    {
                        "file": f"{name}.svg",
                        "page": page_index,
                        "bbox": [round(coord, 1) for coord in box],
                        "labels": labels,
                        "bytes": len(svg),
                    }
                )

        # Write the manifest of everything emitted
        with open(os.path.join(args.outdir, "figures.json"), "w", encoding="utf-8") as manifest_file:
            json.dump(manifest, manifest_file, ensure_ascii=False, indent=2)

    # Summarize the run on stdout
    print(f"{len(manifest)} figures -> {args.outdir}")
    # List each emitted figure with its page, bbox, size, and a label preview
    for entry in manifest:
        bbox_text = str(entry["bbox"])
        label_preview = entry["labels"][:24]
        # Columns up to the byte size, then the label preview
        row = f"  {entry['file']:<20} p{entry['page']:<2} {bbox_text:<30} {entry['bytes']:>7}B"
        print(f"{row}  labels={label_preview!r}")
    # Nothing emitted usually means a raster PDF
    if not manifest:
        print("  (none found — is this a vector PDF with figures? rasters aren't handled)")


if __name__ == "__main__":
    sys.exit(main())
