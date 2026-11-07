#!/usr/bin/env bash
# Opens an interactive psql session on the staging or production database, through the
# tunnel: reuses one that is already open, otherwise opens its own and closes it when psql
# exits.
# Usage: ./psql.sh [prod|staging]   (default: prod)
#
# Autocommit is off, so nothing the session writes lands until COMMIT, and quitting without
# one rolls it back.

set -euo pipefail

# Environment to connect to: prod or staging.
environment="${1:-prod}"

# Reject anything that isn't a known environment.
case "$environment" in
    prod|staging) ;;
    *)
        echo "Usage: $0 [prod|staging]" >&2
        exit 1
        ;;
esac

# Resolve this script's own directory, so it runs from anywhere.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The main checkout, whose scripts folder holds the .env files a worktree has no copy of.
main_root="$(dirname "$(git -C "$script_dir" rev-parse --path-format=absolute --git-common-dir)")"

# Load the layered environment for the chosen environment.
# shellcheck source=lib-env.sh
. "$main_root/backend/scripts/lib-env.sh"
load_env "$environment"

# Reuse whatever tunnel is already open, or raise one that closes again on exit.
# shellcheck source=lib-tunnel.sh
. "$main_root/backend/scripts/lib-tunnel.sh"
ensure_tunnel

# What psql reads the password out of, so no credential rides in an argument list.
export PGPASSWORD="$DB_PASSWORD"

# The server closes a session left idle inside a transaction after 15 minutes, releasing its locks.
export PGOPTIONS="-c idle_in_transaction_session_timeout=15min"

# The session, run rather than exec'd so the tunnel's exit trap still fires once it ends.
psql \
    --host localhost \
    --port "$DB_TUNNEL_PORT" \
    --username "$DB_USERNAME" \
    --dbname "$DB_NAME" \
    --set AUTOCOMMIT=off
