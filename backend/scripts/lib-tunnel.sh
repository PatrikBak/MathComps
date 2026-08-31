#!/usr/bin/env bash
# Makes the remote database reachable at localhost:$DB_TUNNEL_PORT.
# Source this after lib-env.sh's load_env, then call: ensure_tunnel
#
# A tunnel someone else opened (open-db-tunnel.sh, another script) is reused and left
# running; one this library opens is closed again by the EXIT trap it installs.

# PID of the tunnel this shell opened, empty while we are reusing somebody else's.
tunnel_pid=""

# Fails with a clear message when a variable the connection or tunnel needs is unset.
# `environment` names the .env layer to point at and is set by the script that sources this.
# shellcheck disable=SC2154
require_var() {
    # Name of the variable to check.
    local name="$1"

    # Bail out when the variable that name points at holds nothing.
    if [ -z "${!name:-}" ]; then
        echo "Error: required variable '$name' is not set (check .env / .env.$environment)." >&2
        exit 1
    fi
}

# Succeeds when something is already accepting connections on the tunnel port.
port_is_open() {
    bash -c "echo > /dev/tcp/localhost/$DB_TUNNEL_PORT" 2>/dev/null
}

# Closes the tunnel only when we were the ones who opened it.
close_own_tunnel() {
    if [ -n "$tunnel_pid" ]; then
        kill "$tunnel_pid" 2>/dev/null || true
        wait "$tunnel_pid" 2>/dev/null || true
    fi
}

# Reuses whatever already listens on the tunnel port, otherwise opens a tunnel and waits for
# it to accept connections. Reads `environment` for its messages, so set that before calling.
ensure_tunnel() {
    require_var SSH_HOST
    require_var SSH_REMOTE_HOST
    require_var SSH_REMOTE_PORT
    require_var DB_TUNNEL_PORT
    require_var DB_NAME
    require_var DB_USERNAME
    require_var DB_PASSWORD

    # Armed before we open anything, so a failure during startup still tears our tunnel down.
    trap close_own_tunnel EXIT

    if port_is_open; then
        echo "Reusing existing tunnel on localhost:$DB_TUNNEL_PORT (make sure it targets $environment)."
        return 0
    fi

    # Nothing listening yet — open our own in the background and remember its PID for cleanup.
    echo "Opening SSH tunnel to $environment database (localhost:$DB_TUNNEL_PORT -> $SSH_REMOTE_HOST:$SSH_REMOTE_PORT)..."
    ssh -N -T \
        -L "${DB_TUNNEL_PORT}:${SSH_REMOTE_HOST}:${SSH_REMOTE_PORT}" \
        "$SSH_HOST" &
    tunnel_pid=$!

    # Wait for the tunnel to start accepting connections before handing it to the caller.
    local attempts=0
    until port_is_open; do
        attempts=$((attempts + 1))
        if [ "$attempts" -ge 50 ]; then
            echo "Error: tunnel did not come up on localhost:$DB_TUNNEL_PORT within ~10s." >&2
            exit 1
        fi
        sleep 0.2
    done
}
