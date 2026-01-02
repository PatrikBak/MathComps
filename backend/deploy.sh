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
    echo "==> Creating traefik-public network"
    docker network create traefik-public
fi

# Ensure Traefik is running (shared reverse proxy for all environments)
if ! docker ps --format '{{.Names}}' | grep -q '^traefik$'; then
    echo "==> Starting Traefik"
    docker compose -f docker-compose.traefik.yml --env-file .env up -d
fi

# Print which environment we're deploying
echo "==> Deploying $ENV environment"

# Run docker compose with:
# -f docker-compose.yml        = base configuration
# -f $COMPOSE_OVERRIDE         = environment-specific overrides (prods or staging)
# --env-file .env              = load shared environment variables
# --env-file $ENV_FILE         = load environment-specific overrides (later file wins)
# "$@"                         = pass all remaining arguments to docker compose
docker compose \
    -f docker-compose.yml \
    -f "$COMPOSE_OVERRIDE" \
    --env-file .env \
    --env-file "$ENV_FILE" \
    "$@"
