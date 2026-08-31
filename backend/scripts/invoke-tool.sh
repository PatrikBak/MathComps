#!/usr/bin/env bash
# Runs a .NET CLI tool against the staging or production database, reached through an
# SSH tunnel: reuses an already-open tunnel if one is listening, otherwise opens its
# own and tears that one down on exit. Points the tool's connection string at it.
#
# Usage: ./invoke-tool.sh [-e prod|staging] [-p "Profile"] <command> [args...]
# Examples:
#   ./invoke-tool.sh sync-users
#   ./invoke-tool.sh -e staging bulk-import validate ./my-draft
#   ./invoke-tool.sh -e staging bulk-import validate 'data/problems/skmo-*'   # globs / many folders
#   ./invoke-tool.sh -e prod bulk-import apply ./my-draft
#   ./invoke-tool.sh -e prod competitions ./data/problems/mc-2026-1.group.json --dry-run
#   ./invoke-tool.sh embeddings -p "Regenerate"

set -euo pipefail

# Resolve this script's own directory so project and .env paths are CWD-independent.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src_dir="$script_dir/../src"

# Print usage and the list of known commands.
usage() {
    cat >&2 <<'EOF'
Usage: ./invoke-tool.sh [-e <prod|staging>] [-p <Profile>] <command> [args...]

Options:
  -e, --env       Environment (prod or staging, default: prod)
  -p, --profile   Launch profile from launchSettings.json

Commands:
  embeddings     - Generate embeddings
  sync-users     - Sync all users from Clerk
  bulk-import    - Import problem drafts (e.g. bulk-import apply ./my-draft)
  competitions   - Declare a hosted group from its manifest (e.g. competitions ./my-group.group.json)
EOF
}

# Environment to target — prod or staging. Defaults to prod; the -e/--env option overrides it.
environment="prod"

# Optional launch profile from launchSettings.json.
profile=""

# Parse leading options up to the first non-option, which is the command.
while [ "$#" -gt 0 ]; do
    case "$1" in
        -e|--env) environment="$2"; shift 2 ;;
        -p|--profile) profile="$2"; shift 2 ;;
        --) shift; break ;;
        -*) echo "Unknown option: $1" >&2; usage; exit 1 ;;
        *) break ;;
    esac
done

# The command is the first positional; everything after it is passed through to the tool.
tool_command="${1:-}"
shift || true
rest=( "$@" )

# A command is required.
if [ -z "$tool_command" ]; then
    usage
    exit 1
fi

# Only prod and staging are valid environments.
case "$environment" in
    prod|staging) ;;
    *) echo "Error: --env must be 'prod' or 'staging', got '$environment'." >&2; exit 1 ;;
esac

# Load the layered environment for the chosen environment.
# shellcheck source=lib-env.sh
. "$script_dir/lib-env.sh"
load_env "$environment"

# Reach the database, reusing a tunnel that is already open.
# shellcheck source=lib-tunnel.sh
. "$script_dir/lib-tunnel.sh"
ensure_tunnel

# Point every tool's DB connection at the tunneled remote database.
export ConnectionStrings__DefaultConnection="Host=localhost;Port=$DB_TUNNEL_PORT;Database=$DB_NAME;Username=$DB_USERNAME;Password=$DB_PASSWORD"

# Run a tool with dotnet run against its project, with a profile, no args, or passthrough args.
# We run from the user's CWD so relative path args resolve against it; each tool finds its own
# config and repo data from its assembly location.
run_in() {
    # Absolute path to the tool's project directory.
    local project_dir="$1"
    shift
    if [ -n "$profile" ]; then
        dotnet run -c Release --project "$project_dir" --launch-profile "$profile"
    elif [ "$#" -eq 0 ]; then
        dotnet run -c Release --project "$project_dir"
    else
        dotnet run -c Release --project "$project_dir" -- "$@"
    fi
}

# Dispatch a command to its project, prepending any fixed subcommand and appending passthrough args.
run_tool() {
    # Project directory name under src/.
    local project_name="$1"
    shift
    run_in "$src_dir/$project_name" "$@" ${rest[@]+"${rest[@]}"}
}

# Map each command to its project (and fixed subcommand where the tool needs one).
# set +e so we can capture the tool's exit code and propagate it after the tunnel is closed.
set +e
case "$tool_command" in
    embeddings)   run_tool "MathComps.Cli.Embeddings" ;;
    sync-users)   run_tool "MathComps.Cli.UserSync" ;;
    bulk-import)  run_tool "MathComps.Cli.BulkImport" ;;
    competitions) run_tool "MathComps.Cli.Competitions" ;;
    *) echo "Unknown command: $tool_command" >&2; usage; exit 1 ;;
esac
status=$?
set -e

# Exit with the tool's status; the EXIT trap closes the tunnel.
exit "$status"
