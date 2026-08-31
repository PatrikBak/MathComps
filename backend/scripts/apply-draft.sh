#!/usr/bin/env bash
# Imports a problem draft into the staging or production database, and optionally deletes the
# AI-defense sessions argued on that competition. A defense snapshots the problem's statement and
# reference solution when it starts and never re-reads them, so a session started before a rewrite
# argues one text while the site shows another. Clearing them is how that divergence is resolved.
#
# One tunnel serves the whole run: it is opened (or reused) once here, and the bulk-import tool
# and psql both go through it.
#
# Usage: ./apply-draft.sh [-e prod|staging] [--clear-defenses] [--validate-only] <draft-folder>
# Examples:
#   ./apply-draft.sh --validate-only ./data/problems/mc-practice-2026
#   ./apply-draft.sh -e staging ./data/problems/mc-practice-2026
#   ./apply-draft.sh -e prod --clear-defenses ./data/problems/mc-practice-2026

set -euo pipefail

# Resolve this script's own directory so the sibling scripts and .env files are CWD-independent.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Print the invocation form and what each option does.
usage() {
    cat >&2 <<'EOF'
Usage: ./apply-draft.sh [-e <prod|staging>] [--clear-defenses] [--validate-only] <draft-folder>

Options:
  -e, --env             Environment (prod or staging, default: prod)
      --clear-defenses  Delete every defense session on the draft's competition, after the import
      --validate-only   Stop after validate; write nothing
EOF
}

# Environment to target — prod or staging. Defaults to prod; the -e/--env option overrides it.
environment="prod"

# Whether to delete the competition's defense sessions once the import lands.
clear_defenses="false"

# Whether to stop after the read-only validate.
validate_only="false"

# Parse leading options up to the first non-option, which is the draft folder.
while [ "$#" -gt 0 ]; do
    case "$1" in
        -e|--env) environment="$2"; shift 2 ;;
        --clear-defenses) clear_defenses="true"; shift ;;
        --validate-only) validate_only="true"; shift ;;
        --) shift; break ;;
        -*) echo "Unknown option: $1" >&2; usage; exit 1 ;;
        *) break ;;
    esac
done

# The draft folder is the one positional argument.
draft_folder="${1:-}"

# An existing folder is required.
if [ -z "$draft_folder" ] || [ ! -d "$draft_folder" ]; then
    echo "Error: give an existing draft folder." >&2
    usage
    exit 1
fi

# Only prod and staging are valid environments.
case "$environment" in
    prod|staging) ;;
    *) echo "Error: --env must be 'prod' or 'staging', got '$environment'." >&2; exit 1 ;;
esac

# The metadata file is what makes a folder a draft.
if [ ! -f "$draft_folder/_meta.yaml" ]; then
    echo "Error: $draft_folder holds no _meta.yaml, so it isn't a draft folder." >&2
    exit 1
fi

# The competition the draft targets, read off its own metadata so the two can't drift apart.
competition_path="$(sed -n 's/^competition:[[:space:]]*\([^[:space:]#]*\).*/\1/p' "$draft_folder/_meta.yaml" | head -1)"

# Without it there is nothing to key the defense listing on.
if [ -z "$competition_path" ]; then
    echo "Error: no 'competition:' line in $draft_folder/_meta.yaml." >&2
    exit 1
fi

# Load the layered environment for the chosen environment.
# shellcheck source=lib-env.sh
. "$script_dir/lib-env.sh"
load_env "$environment"

# One tunnel serves every step below, invoke-tool.sh included: it finds this one listening and
# reuses it.
# shellcheck source=lib-tunnel.sh
. "$script_dir/lib-tunnel.sh"
ensure_tunnel

# Runs the SQL read from stdin against the tunneled database, with the draft's competition bound
# to :'competition_path'.
run_sql() {
    # Where the statement is staged for psql to read.
    local sql_file
    sql_file="$(mktemp)"

    # Take the statement off our own stdin, which is the caller's heredoc.
    cat > "$sql_file"

    # The run's status, held so the temp file is cleaned up either way.
    local status=0

    # Hand the statement to psql over the tunnel.
    PGPASSWORD="$DB_PASSWORD" psql \
        --host=localhost \
        --port="$DB_TUNNEL_PORT" \
        --username="$DB_USERNAME" \
        --dbname="$DB_NAME" \
        --set=ON_ERROR_STOP=1 \
        --set=competition_path="$competition_path" \
        --file="$sql_file" || status=$?

    # Drop the staged copy.
    rm -f "$sql_file"

    # Report psql's own status to the caller.
    return "$status"
}

# The draft's own dry run: format, registry and a read-only preview of what the import would do.
echo
echo "=== Validating $draft_folder against $environment ==="
"$script_dir/invoke-tool.sh" -e "$environment" bulk-import validate "$draft_folder"

# What the --clear-defenses step would remove, printed whether or not it is armed, so the cost of
# the import is visible before it happens.
echo
echo "=== Defense sessions on $competition_path ==="
run_sql <<'EOF'
SELECT p.slug, u.username, ds.created_at,
       (SELECT count(*) FROM defense_turns turn WHERE turn.session_id = ds.id) AS turns
FROM defense_sessions ds
JOIN problem_defenses pd ON pd.defense_session_id = ds.id
JOIN problems p ON p.id = pd.problem_id
JOIN rounds r ON r.id = p.round_id
JOIN competitions c ON c.id = r.competition_id
LEFT JOIN users u ON u.id = ds.user_id
WHERE c.path = :'competition_path'
ORDER BY p.slug, ds.created_at;
EOF

# Everything up to here only read, so this is where a dry run stops.
if [ "$validate_only" = "true" ]; then
    echo
    echo "Validate only. Nothing was written."
    exit 0
fi

# The real import: problems created or overwritten, figures uploaded.
echo
echo "=== Applying $draft_folder to $environment ==="
"$script_dir/invoke-tool.sh" -e "$environment" bulk-import apply "$draft_folder"

# The delete runs after the import, so nothing that snapshotted the old text is left behind.
if [ "$clear_defenses" = "true" ]; then
    echo
    echo "=== Deleting defense sessions on $competition_path ==="

    # Turns, attempts, calls, reports, feedback, admin notes and reviews all cascade off the
    # session. `defense_spends` deliberately carries no session foreign key: it is the ledger the
    # daily spend ceiling reads, and wiping it would make the ceiling evadable.
    run_sql <<'EOF'
DELETE FROM defense_sessions ds
USING problem_defenses pd, problems p, rounds r, competitions c
WHERE pd.defense_session_id = ds.id
  AND p.id = pd.problem_id
  AND r.id = p.round_id
  AND c.id = r.competition_id
  AND c.path = :'competition_path';
EOF
fi

echo
echo "Done."
