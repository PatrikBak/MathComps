#!/bin/bash
# What CI's deploy key is pinned to by a forced command in the server's authorized_keys, so this file is
# the only thing that key can run. The commit to deploy arrives in SSH_ORIGINAL_COMMAND, since a forced
# command replaces whatever the client asked to run.
set -euo pipefail

# Everything below is relative to the backend directory this script sits in
cd "$(dirname "${BASH_SOURCE[0]}")"

# The commit CI wants deployed
target="${SSH_ORIGINAL_COMMAND:-}"

# A hand run passes no commit and takes the current tip
if [[ ! "$target" =~ ^[0-9a-f]{40}$ ]]; then
    echo "==> No commit given, taking origin/main"
    target=origin/main
fi

# The one line naming what this run ships
echo "==> Deploying $target"

# The branch the server checkout is on
branch=$(git rev-parse --abbrev-ref HEAD)

# A detached HEAD is somebody having pinned prod to a commit by hand. Leave their pin in place, and say so.
if [[ "$branch" != "main" ]]; then
    echo "==> Server checkout is on '$branch', not main. Refusing to deploy over it."
    exit 1
fi

# The objects for the commit CI passed
git fetch origin

# Land on exactly that commit: main can have picked up a newer merge since those gates ran. --ff-only
# leaves a server-side divergence alone.
git merge --ff-only "$target"

# Compose reports a failure as a failed dependency, so pull the whole stack's logs. The migration that
# failed is named in the migrate service's own.
./deploy-prod.sh up -d --build || {
    ./deploy-prod.sh logs --tail=50
    exit 1
}

# Compose returns once the container is started, which is well before the API can serve. Wait for the
# healthcheck in docker-compose.yml to agree, so the job's verdict is about a serving API.
echo "==> Waiting for the API to report healthy"

# The container to watch
container=$(./deploy-prod.sh ps -q api)

# Stands in for the health status until there is a container to inspect
status=missing

# Poll for five minutes, which is well past the healthcheck's own worst case
if [[ -n "$container" ]]; then
    for _ in $(seq 60); do
        # A container removed mid-wait reports gone, and the loop breaks on it
        status=$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo gone)

        # starting is the only state still worth waiting on
        [[ "$status" == "starting" ]] || break

        sleep 5
    done
fi

# The deploy landed, and the sha proves which one
if [[ "$status" == "healthy" ]]; then
    echo "==> Healthy at $(git rev-parse HEAD)"
    exit 0
fi

# Name the state it got stuck in
echo "==> API never became healthy (last status: $status)"

# The stack's own logs, so the job log carries them. /health probes the database, so postgres is as likely
# to hold the reason as the API is.
./deploy-prod.sh logs --tail=50

# Red job: prod is on this build with a failing healthcheck
exit 1
