#!/usr/bin/env bash
# Opens an SSH tunnel to the staging or production database and holds it open.
# Usage: ./open-db-tunnel.sh [prod|staging]   (default: prod)
#
# Leave this running in a terminal; other tools (psql, mathcomps-ro) then reach
# the remote DB at localhost:$DB_TUNNEL_PORT. Ctrl-C to close the tunnel.

set -euo pipefail

# Environment to tunnel into — prod or staging.
environment="${1:-prod}"

# Reject anything that isn't a known environment.
case "$environment" in
    prod|staging) ;;
    *)
        echo "Usage: $0 [prod|staging]" >&2
        exit 1
        ;;
esac

# Resolve this script's own directory so the env loader finds its .env files.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load the layered environment for the chosen environment.
# shellcheck source=lib-env.sh
. "$script_dir/lib-env.sh"
load_env "$environment"

# Show the port mapping so it's clear what's being forwarded.
echo "Opening SSH tunnel to $environment database..."
echo "  Local port: $DB_TUNNEL_PORT -> $SSH_REMOTE_HOST:$SSH_REMOTE_PORT"

# Forward the local port to the remote DB over SSH and block until interrupted.
# Connection details (user, host, key) come from the SSH_HOST alias in ~/.ssh/config.
#   -N       no remote command, just forward
#   -T       no pseudo-terminal
#   -L       local-port:remote-host:remote-port
exec ssh -N -T \
    -L "${DB_TUNNEL_PORT}:${SSH_REMOTE_HOST}:${SSH_REMOTE_PORT}" \
    "$SSH_HOST"
