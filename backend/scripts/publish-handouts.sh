#!/usr/bin/env bash
# Publishes the handouts to prod's R2 bucket: their figures, their PDFs and the examiner's problem content. Run it
# after a PR touching handouts merges, from a checkout at origin/main with nothing uncommitted, which it checks first,
# so prod's bucket only ever holds what main does.
#
# Usage: ./publish-handouts.sh [patterns...] [Handouts CLI options...]
# Examples:
#   ./publish-handouts.sh # every handout in every language
#   ./publish-handouts.sh 'factorization.*.tex'
#   ./publish-handouts.sh --force-asy # every handout, every figure recompiled

set -euo pipefail

# Resolve this script's own directory so the checkout and the .env paths are CWD-independent.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The checkout whose handouts are published.
repo_root="$(git -C "$script_dir" rev-parse --show-toplevel)"

# The main checkout, which holds the .env files a worktree has no copy of.
main_root="$(dirname "$(git -C "$script_dir" rev-parse --path-format=absolute --git-common-dir)")"

# Learn where main is now.
git -C "$repo_root" fetch --quiet origin main

# The commit checked out, and the one origin/main is at.
head_commit="$(git -C "$repo_root" rev-parse HEAD)"
main_commit="$(git -C "$repo_root" rev-parse origin/main)"

# A checkout anywhere but main would publish what main doesn't hold.
if [ "$head_commit" != "$main_commit" ]; then
    echo "Error: $repo_root is at $head_commit, but origin/main is at $main_commit. Publish from a checkout at" \
        "origin/main, e.g. after 'git pull' on main." >&2
    exit 1
fi

# The tracked files edited in the checkout.
uncommitted="$(git -C "$repo_root" status --porcelain --untracked-files=no)"

# Anything new among the handout sources, which the patterns would pick up.
new_sources="$(git -C "$repo_root" status --porcelain -- data/handouts)"

# Either would be published along with main's handouts.
if [ -n "$uncommitted" ] || [ -n "$new_sources" ]; then
    echo "Error: $repo_root differs from origin/main. Commit, stash or remove these first:" >&2
    printf '%s\n' "$uncommitted" "$new_sources" | sort -u | sed '/^$/d' >&2
    exit 1
fi

# Load prod's environment, whose R2 keys override the dev ones in user secrets.
# shellcheck source=lib-env.sh
. "$main_root/backend/scripts/lib-env.sh"
load_env prod

# Stop before the build when prod's environment holds no publish keys.
if [ -z "${CloudflareR2__AccessKeyId:-}" ]; then
    echo "Error: no R2 publish keys in $main_root/backend/scripts/.env.prod." >&2
    exit 1
fi

# Every handout in every language, unless patterns come first.
if [ "$#" -eq 0 ] || [[ "$1" == -* ]]; then
    set -- '*.sk.tex' '*.en.tex' '*.cs.tex' "$@"
fi

# Build the handouts and upload them to prod's bucket.
dotnet run --project "$repo_root/backend/src/MathComps.Cli.Handouts" -- --publish "$@"
