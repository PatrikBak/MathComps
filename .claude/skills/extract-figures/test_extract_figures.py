#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["pymupdf>=1.27,<2", "pytest>=8"]
# ///
"""Regression tests for extract_figures.py — pinning the subtle path/bbox parsing whose bugs are silent.

Run (self-contained, uv installs pymupdf + pytest from the inline deps):
    uv run .claude/skills/extract-figures/test_extract_figures.py

Lint the skill dir with the same settings the repo's other Python uses:
    uvx ruff check --line-length 120 --select E,F,I,UP,B .claude/skills/extract-figures/
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pymupdf
import pytest

# Load the single-file script as a module (it isn't a package, so import it by path)
_MODULE_PATH = Path(__file__).with_name("extract_figures.py")
_spec = importlib.util.spec_from_file_location("extract_figures", _MODULE_PATH)
extract_figures = importlib.util.module_from_spec(_spec)
# Register before exec so the script's @dataclass can resolve its own module
sys.modules[_spec.name] = extract_figures
_spec.loader.exec_module(extract_figures)


def _build_test_pdf(directory):
    """Build a 2-page PDF exercising the collision and text-free-page cases; return its path.

    Page 0 holds two triangles stacked at the SAME left margin (filename-collision case);
    page 1 holds a triangle + circle with NO text anywhere (the missing-<defs> crash case).
    """
    # A fresh in-memory document
    doc = pymupdf.open()

    # Page 0
    page = doc.new_page(width=400, height=600)
    # Top triangle — its three sides
    for start, end in [((60, 60), (160, 60)), ((160, 60), (110, 140)), ((110, 140), (60, 60))]:
        page.draw_line(start, end, color=(0, 0, 0), width=1)
    # Label its vertices A/B/C
    page.insert_text((50, 58), "A")
    page.insert_text((164, 58), "B")
    page.insert_text((104, 156), "C")
    # Bottom triangle at the same left margin — its three sides
    for start, end in [((60, 360), (160, 360)), ((160, 360), (110, 440)), ((110, 440), (60, 360))]:
        page.draw_line(start, end, color=(0, 0, 0), width=1)
    # Label its vertices P/Q/R
    page.insert_text((50, 358), "P")
    page.insert_text((164, 358), "Q")
    page.insert_text((104, 456), "R")

    # Page 1 — a text-free figure
    page2 = doc.new_page(width=400, height=400)
    # A triangle
    for start, end in [((50, 50), (250, 50)), ((250, 50), (150, 250)), ((150, 250), (50, 50))]:
        page2.draw_line(start, end, color=(0, 0, 0), width=1)
    # ...and a circle
    page2.draw_circle((150, 150), 40, color=(0, 0, 0), width=1)

    # Save under the given directory
    pdf_path = Path(directory) / "test.pdf"
    doc.save(pdf_path)
    doc.close()
    # The built PDF's path
    return pdf_path


def test_element_bbox_handles_hv_commands():
    """A path mixing H/V single-coordinate commands gets the true page-space bbox, not a corrupted one."""
    # A closed polygon using H/V shorthand, under PyMuPDF's y-flip transform
    path = '<path transform="matrix(1,0,0,-1,0,500)" d="M100 400V200H400Z"/>'
    # Compute the transformed bbox
    bbox = extract_figures._element_bbox(path)
    # H and V each carry one coordinate, so x and y must stay on their own axes -> this exact box
    assert bbox == [100.0, 100.0, 400.0, 300.0]


def test_path_points_walks_rect_with_hv():
    """A rectangle drawn with H/V shorthand yields all four corners, on the right axes."""
    # Walk a rectangle whose sides are H/V single-coordinate commands
    points = extract_figures._path_points("M50 350H200V450H50Z")
    # Each corner the pen visits must be present
    assert (50.0, 350.0) in points
    assert (200.0, 350.0) in points
    assert (200.0, 450.0) in points
    assert (50.0, 450.0) in points


def test_path_points_includes_curve_control_points():
    """A cubic Bézier contributes its control points (a safe over-estimate of the curve's extent)."""
    # Walk a cubic from (0,0) with controls (10,100),(90,100) to (100,0)
    points = extract_figures._path_points("M0 0C10 100 90 100 100 0")
    # Control points bound the curve, so they belong in the bbox hull
    assert (10.0, 100.0) in points
    assert (90.0, 100.0) in points
    assert (100.0, 0.0) in points


def test_shape_kinds_counts_vertical_but_not_horizontal():
    """A vertical stroke counts as non-horizontal; a lone horizontal stroke (a fraction bar) does not."""
    # A page carrying one vertical line
    vertical_doc = pymupdf.open()
    vertical_page = vertical_doc.new_page(width=200, height=200)
    vertical_page.draw_line((50, 40), (50, 160), color=(0, 0, 0), width=1)
    # A vertical stroke registers as non-horizontal
    assert extract_figures._shape_kinds(vertical_page.get_drawings(), [0, 0, 200, 200]) > 0
    # Release the doc
    vertical_doc.close()

    # A page carrying one horizontal line
    horizontal_doc = pymupdf.open()
    horizontal_page = horizontal_doc.new_page(width=200, height=200)
    horizontal_page.draw_line((20, 100), (180, 100), color=(0, 0, 0), width=1)
    # An all-horizontal cluster reads as an equation (zero non-horizontal strokes)
    assert extract_figures._shape_kinds(horizontal_page.get_drawings(), [0, 0, 200, 200]) == 0
    # Release the doc
    horizontal_doc.close()


def test_end_to_end_distinct_names_and_no_text_free_crash(tmp_path, monkeypatch):
    """Stacked same-column figures get distinct files and a text-free page doesn't abort the run."""
    # Build the fixture PDF
    pdf_path = _build_test_pdf(tmp_path)
    # A fresh output dir
    out_dir = tmp_path / "out"
    # Point the CLI's argv at the fixture
    monkeypatch.setattr(sys, "argv", ["extract_figures.py", str(pdf_path), str(out_dir), "--no-preview"])
    # Run extraction (must not raise on the text-free page 1)
    extract_figures.main()

    # The two stacked triangles plus the text-free figure = three SVGs
    svg_names = sorted(path.name for path in out_dir.glob("fig-*.svg"))
    assert len(svg_names) == 3
    # No collision: every emitted name is distinct
    assert len(set(svg_names)) == 3
    # The manifest agrees with what's on disk
    manifest = json.loads((out_dir / "figures.json").read_text(encoding="utf-8"))
    assert len(manifest) == 3
    # The text-free page (page 1) still produced a figure
    assert any(entry["page"] == 1 for entry in manifest)


def test_rerun_clears_stale_outputs(tmp_path, monkeypatch):
    """A second run into the same dir clears the first run's figures, so the dir always matches the manifest."""
    # Build the fixture and a shared output dir
    pdf_path = _build_test_pdf(tmp_path)
    out_dir = tmp_path / "out"
    # Point argv at the run with default margins
    monkeypatch.setattr(sys, "argv", ["extract_figures.py", str(pdf_path), str(out_dir), "--no-preview"])
    # First run
    extract_figures.main()
    # A wider margin shifts the box corners, so the second run renames every figure
    rerun_argv = ["extract_figures.py", str(pdf_path), str(out_dir), "--no-preview", "--margin", "12"]
    monkeypatch.setattr(sys, "argv", rerun_argv)
    # Second run into the same dir
    extract_figures.main()

    # Every SVG left on disk must be referenced by the latest manifest (no stale orphans from run 1)
    disk_svgs = {path.name for path in out_dir.glob("fig-*.svg")}
    manifest = json.loads((out_dir / "figures.json").read_text(encoding="utf-8"))
    manifest_svgs = {entry["file"] for entry in manifest}
    assert disk_svgs == manifest_svgs


def test_labels_unescape_xml_entities(tmp_path, monkeypatch):
    """A figure label containing <, >, or & lands in the manifest as real characters, not XML entities."""
    # A fresh page
    doc = pymupdf.open()
    page = doc.new_page(width=300, height=300)
    # Draw a triangle
    for start, end in [((60, 80), (160, 80)), ((160, 80), (110, 160)), ((110, 160), (60, 80))]:
        page.draw_line(start, end, color=(0, 0, 0), width=1)
    # Label it with characters that XML-encode (< and &), hugging the top edge
    page.insert_text((95, 76), "A<B&C")
    # Save the fixture
    pdf_path = tmp_path / "labels.pdf"
    doc.save(pdf_path)
    doc.close()

    # A fresh output dir
    out_dir = tmp_path / "out"
    # Point argv at the labelled triangle
    monkeypatch.setattr(sys, "argv", ["extract_figures.py", str(pdf_path), str(out_dir), "--no-preview"])
    # Run extraction
    extract_figures.main()

    # The collected label text carries the real characters, never their &#x..; / &amp; entities
    manifest = json.loads((out_dir / "figures.json").read_text(encoding="utf-8"))
    all_labels = "".join(entry["labels"] for entry in manifest)
    assert "<" in all_labels and "&" in all_labels
    assert "&#x" not in all_labels and "&amp;" not in all_labels


def test_equation_cluster_dropped_unless_kept(tmp_path, monkeypatch):
    """An all-horizontal cluster is dropped as an equation by default but kept with --keep-equation-shapes."""
    # A fresh page
    doc = pymupdf.open()
    page = doc.new_page(width=300, height=300)
    # Three stacked horizontal rules — they cluster into one big-enough box with zero non-horizontal strokes
    for y in (50, 62, 74):
        page.draw_line((20, y), (180, y), color=(0, 0, 0), width=1)
    # Save the fixture
    pdf_path = tmp_path / "equation.pdf"
    doc.save(pdf_path)
    doc.close()

    # Set up the default run (equation filter on)
    default_out = tmp_path / "default"
    monkeypatch.setattr(sys, "argv", ["extract_figures.py", str(pdf_path), str(default_out), "--no-preview"])
    # The all-horizontal cluster is dropped
    extract_figures.main()
    # Nothing emitted
    default_manifest = json.loads((default_out / "figures.json").read_text(encoding="utf-8"))
    assert default_manifest == []

    # Set up the same run with the keep flag
    kept_out = tmp_path / "kept"
    kept_argv = ["extract_figures.py", str(pdf_path), str(kept_out), "--no-preview", "--keep-equation-shapes"]
    monkeypatch.setattr(sys, "argv", kept_argv)
    # The cluster survives as a figure
    extract_figures.main()
    # Exactly one figure emitted
    kept_manifest = json.loads((kept_out / "figures.json").read_text(encoding="utf-8"))
    assert len(kept_manifest) == 1


if __name__ == "__main__":
    # Allow `uv run test_extract_figures.py` to run the suite directly
    sys.exit(pytest.main([__file__, "-q"]))
