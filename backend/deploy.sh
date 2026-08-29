#!/bin/bash
# Deploy script for staging/production environments
# Usage: ./deploy.sh <environment> <docker-compose-commands>
# Examples:
#   ./deploy.sh prod up -d        # Start production
#   ./deploy.sh staging up -d     # Start staging
#   ./deploy.sh staging down      # Stop staging
#   ./deploy.sh prod logs -f api  # View production API logs

# Exit immediately if any command fails (prevents silent errors)
set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the script's directory (so relative paths work correctly)
cd "$SCRIPT_DIR"

# Get the first argument (prod or staging), or empty string if not provided
ENV="${1:-}"

# Remove the first argument from the argument list
shift || true

# Validate that ENV is either "prod" or "staging"
if [[ "$ENV" != "prod" && "$ENV" != "staging" ]]; then
    echo "Usage: $0 <prod|staging> [docker-compose commands]"
    echo ""
    echo "Examples:"
    echo "  $0 prod up -d        # Start production"
    echo "  $0 staging up -d     # Start staging"  
    echo "  $0 staging down      # Stop staging (saves resources)"
    echo "  $0 prod logs -f api  # View production API logs"
    exit 1
fi

# The docker compose subcommand, so the tail of the script can tell a deploy from a `logs`
SUBCOMMAND="${1:-}"

# Serialize the subcommands that mutate the stack, so a hand deploy and an automatic one landing together
# take their turns at recreating containers. Just these three: a long-lived `logs -f` holding the lock
# would park every deploy behind a terminal.
case "$SUBCOMMAND" in
    up | down | restart)
        if [[ -z "${DEPLOY_LOCK_HELD:-}" ]] && command -v flock > /dev/null; then
            # Marks the re-exec below, so the second pass goes straight to the command
            export DEPLOY_LOCK_HELD=1

            # 25 minutes covers a cold rebuild on this box; past that the holder is stuck, not slow. Under
            # the deploy job's own 30-minute cap, so a blocked CI deploy fails here, naming the lock.
            exec flock --timeout 1500 "/tmp/mathcomps-deploy-${ENV}.lock" "$0" "$ENV" "$@"
        fi
        ;;
esac

# Build the environment file name (e.g., ".env.prod" or ".env.staging")
ENV_FILE=".env.${ENV}"

# Build the docker-compose override file name (e.g., "docker-compose.prod.yml")
COMPOSE_OVERRIDE="docker-compose.${ENV}.yml"

# Check if base .env file exists
if [[ ! -f ".env" ]]; then
    echo "Error: Base '.env' file not found."
    echo "Copy '.env.example' to '.env' and configure it."
    exit 1
fi

# Check if the environment-specific file exists
if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: Environment file '$ENV_FILE' not found."
    echo "Copy '.env.${ENV}.example' to '$ENV_FILE' and configure it."
    exit 1
fi

# Ensure traefik-public network exists
if ! docker network inspect traefik-public >/dev/null 2>&1; then
    echo "==> Creating traefik-public network" >&2
    docker network create traefik-public
fi

# Ensure Traefik is running (shared reverse proxy for all environments)
if ! docker ps --format '{{.Names}}' | grep -q '^traefik$'; then
    echo "==> Starting Traefik" >&2
    docker compose -f docker-compose.traefik.yml --env-file .env up -d
fi

# Print which environment we're deploying. Status goes to stderr, here and above, leaving stdout to
# docker compose alone, so a caller can capture what it printed.
echo "==> Deploying $ENV environment" >&2

# Run docker compose with:
# -f docker-compose.yml        = base configuration
# -f $COMPOSE_OVERRIDE         = environment-specific overrides (prods or staging)
# --env-file .env              = load shared environment variables
# --env-file $ENV_FILE         = load environment-specific overrides (later file wins)
# "$@"                         = pass all remaining arguments to docker compose
COMPOSE_STATUS=0
docker compose \
    -f docker-compose.yml \
    -f "$COMPOSE_OVERRIDE" \
    --env-file .env \
    --env-file "$ENV_FILE" \
    "$@" || COMPOSE_STATUS=$?

# Reclaim what a --build leaves behind. Just after an up, the one subcommand here that builds, and on a
# failure too, since a deploy that fell over built an image on its way.
if [[ "$SUBCOMMAND" == "up" ]]; then
    # until=24h keeps yesterday's image as something to roll back onto
    docker image prune -f --filter 'until=24h'

    # The SDK stage's layers, which live in the build cache, out of an image prune's reach
    docker builder prune -f --keep-storage 10GB
fi

exit $COMPOSE_STATUS
