#!/usr/bin/env bash
# Batch-renders each Asymptote .asy file to a .pdf and a .svg next to the source. With no args,
# renders every .asy in this directory; args may be directories, .asy files, or globs. Shared
# modules (_-prefixed and -shared-suffixed) are skipped. Both outputs use -cd <dir> so
# `import _common;` and `include "...-shared.asy";` resolve next to the source.
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# LIBGS: dvisvgm needs the Ghostscript shared library to rasterize PostScript specials, and asy
# needs it for EPS-backed figures (e.g. `patterns`); TeXLive/Mac doesn't locate it automatically,
# so we point LIBGS at libgs.dylib. Without it, dvisvgm silently drops specials and EPS fails.
if [[ -z "${LIBGS:-}" ]]; then
  for cand in \
    /opt/homebrew/lib/libgs.dylib \
    "$(brew --prefix ghostscript 2>/dev/null)/lib/libgs.dylib" \
    /usr/local/lib/libgs.dylib \
    /usr/lib/libgs.so; do
    if [[ -n "$cand" && -e "$cand" ]]; then LIBGS="$cand"; break; fi
  done
fi
if [[ -z "${LIBGS:-}" || ! -e "${LIBGS:-/nonexistent}" ]]; then
  echo "❌  Ghostscript shared library (libgs) not found. Install it (e.g. 'brew install ghostscript')" >&2
  echo "    or set LIBGS to its path. Without it dvisvgm drops PostScript specials and EPS figures fail." >&2
  exit 1
fi
export LIBGS

# Each arg may be a directory (-> *.asy inside), a file (with or without .asy), or a glob.
# No args -> every .asy next to this script (the typical handout-figures layout).
shopt -s nullglob
declare -a candidates=()
if [[ $# -eq 0 ]]; then
  candidates=("$SCRIPT_DIR"/*.asy)
else
  for arg in "$@"; do
    if [[ -d "$arg" ]]; then
      candidates+=("$arg"/*.asy)
    elif [[ -f "$arg" ]]; then
      candidates+=("$arg")
    elif [[ -f "$arg.asy" ]]; then
      candidates+=("$arg.asy")
    else
      # treat as a glob, resolved relative to the script dir if not absolute
      local_matches=($arg)
      [[ ${#local_matches[@]} -eq 0 ]] && local_matches=("$SCRIPT_DIR"/$arg)
      candidates+=("${local_matches[@]}")
    fi
  done
fi

# Skip shared modules: '_' prefix (handout-wide, e.g. _common.asy) and '-shared' suffix
# (per-figure-family, e.g. equal-tangents-shared.asy).
declare -a files=()
for f in "${candidates[@]}"; do
  [[ -f "$f" ]] || continue
  base="$(basename "$f")"
  stem="${base%.asy}"
  [[ "$base" == _* ]] && continue
  [[ "$stem" == *-shared ]] && continue
  files+=("$f")
done

# Guard against no matching filess
if [[ ${#files[@]} -eq 0 ]]; then
  echo "❌  No .asy files found for: ${*:-$SCRIPT_DIR}" >&2
  exit 1
fi

# Process files ones by ones
total=${#files[@]}
echo "Processing $total file(s)..."
ok=0; fail=0; i=0
for f in "${files[@]}"; do
  i=$((i + 1))
  dir="$(cd "$(dirname "$f")" && pwd)"
  stem="$(basename "${f%.asy}")"
  prefix="[$i/$total]"

  # Run asy for both PDF and SVG
  if asy -noView -f pdf -o "$stem" -cd "$dir" "$dir/$stem.asy" >/dev/null 2>&1 \
     && asy -noView -f svg -o "$stem" -cd "$dir" "$dir/$stem.asy" >/dev/null 2>&1 \
     && [[ -f "$dir/$stem.pdf" && -f "$dir/$stem.svg" ]]; then
    echo "$prefix [OK]   $stem.asy"
    ok=$((ok + 1))
  else
    echo "$prefix [FAIL] $stem.asy" >&2
    # Re-run once with output shown so the failure is diagnosable.
    asy -noView -f svg -o "$stem" -cd "$dir" "$dir/$stem.asy" 2>&1 | sed 's/^/         /' >&2 || true
    fail=$((fail + 1))
  fi
done

echo
echo "Done. Success: $ok, Failed: $fail"
[[ $fail -gt 0 ]] && exit 1
exit 0
