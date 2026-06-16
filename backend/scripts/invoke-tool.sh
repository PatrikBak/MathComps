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

# Fail fast with a clear message if a variable the connection or tunnel needs is missing.
require_var() {
    # Name of the variable to check.
    local name="$1"
    if [ -z "${!name:-}" ]; then
        echo "Error: required variable '$name' is not set (check .env / .env.$environment)." >&2
        exit 1
    fi
}
require_var SSH_HOST
require_var SSH_REMOTE_HOST
require_var SSH_REMOTE_PORT
require_var DB_TUNNEL_PORT
require_var DB_NAME
require_var DB_USERNAME
require_var DB_PASSWORD

# Absolutise any passthrough arg that points at an existing path, while we're still in
# the user's CWD — the dispatcher cd's into the project dir before running dotnet, after
# which a relative path (e.g. a draft folder) would resolve against the wrong place.
if [ "${#rest[@]}" -gt 0 ]; then
    for index in "${!rest[@]}"; do
        argument="${rest[$index]}"
        if [ -d "$argument" ]; then
            rest[$index]="$(cd "$argument" && pwd)"
        elif [ -f "$argument" ]; then
            rest[$index]="$(cd "$(dirname "$argument")" && pwd)/$(basename "$argument")"
        fi
    done
fi

# Point every tool's DB connection at the tunneled remote database.
export ConnectionStrings__DefaultConnection="Host=localhost;Port=$DB_TUNNEL_PORT;Database=$DB_NAME;Username=$DB_USERNAME;Password=$DB_PASSWORD"

# Succeeds when something is already accepting connections on the tunnel port.
port_is_open() {
    bash -c "echo > /dev/tcp/localhost/$DB_TUNNEL_PORT" 2>/dev/null
}

# Close only a tunnel we opened ourselves; a tunnel opened elsewhere (open-db-tunnel.sh)
# is left running. Armed before we open anything so a startup failure still cleans up.
tunnel_pid=""
cleanup() {
    if [ -n "$tunnel_pid" ]; then
        kill "$tunnel_pid" 2>/dev/null || true
        wait "$tunnel_pid" 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Reuse an existing tunnel if one is already listening; otherwise open our own and wait for it.
if port_is_open; then
    echo "Reusing existing tunnel on localhost:$DB_TUNNEL_PORT (make sure it targets $environment)."
else
    # Nothing listening yet — open our own tunnel in the background and remember its PID so cleanup can kill it.
    echo "Opening SSH tunnel to $environment database (localhost:$DB_TUNNEL_PORT -> $SSH_REMOTE_HOST:$SSH_REMOTE_PORT)..."
    ssh -N -T \
        -L "${DB_TUNNEL_PORT}:${SSH_REMOTE_HOST}:${SSH_REMOTE_PORT}" \
        "$SSH_HOST" &
    tunnel_pid=$!

    # Wait for the tunnel to start accepting connections before running the tool.
    attempts=0
    until port_is_open; do
        attempts=$((attempts + 1))
        if [ "$attempts" -ge 50 ]; then
            echo "Error: tunnel did not come up on localhost:$DB_TUNNEL_PORT within ~10s." >&2
            exit 1
        fi
        sleep 0.2
    done
fi

# Run a tool: cd into its project, then dotnet run with a profile, no args, or passthrough args.
run_in() {
    # Absolute path to the tool's project directory.
    local project_dir="$1"
    shift
    cd "$project_dir"
    if [ -n "$profile" ]; then
        dotnet run -c Release --launch-profile "$profile"
    elif [ "$#" -eq 0 ]; then
        dotnet run -c Release
    else
        dotnet run -c Release -- "$@"
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
    *) echo "Unknown command: $tool_command" >&2; usage; exit 1 ;;
esac
status=$?
set -e

# Exit with the tool's status; the EXIT trap closes the tunnel.
exit "$status"
