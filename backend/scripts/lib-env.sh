#!/usr/bin/env bash
# Loads environment variables from the layered .env files.
# Source this, then call: load_env <prod|staging>
#
# Loading order (later files override earlier ones):
#   1. .env.example                — base defaults
#   2. .env.{environment}.example  — env-specific defaults (ports)
#   3. .env                        — your secrets (SSH key, passwords)
#   4. .env.{environment}          — your env-specific overrides (optional)

# Read KEY=VALUE lines from a single .env file and export them; missing files are skipped.
load_env_file() {
    # Path to the .env file to load.
    local file_path="$1"

    # Nothing to do if the file isn't there.
    [ -f "$file_path" ] || return 0

    # Walk the file line by line, exporting each non-comment KEY=VALUE pair.
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip blank lines (nothing left once whitespace is stripped).
        [ -z "${line//[[:space:]]/}" ] && continue
        # Skip comments — a line whose first non-space char is '#'.
        case "${line#"${line%%[![:space:]]*}"}" in
            \#*) continue ;;
        esac

        # Only KEY=VALUE lines are meaningful; ignore anything without an '='.
        case "$line" in
            *=*) ;;
            *) continue ;;
        esac

        # Split on the first '=', then trim surrounding whitespace off key and value.
        local key="${line%%=*}"
        local value="${line#*=}"
        key="${key#"${key%%[![:space:]]*}"}"
        key="${key%"${key##*[![:space:]]}"}"
        value="${value#"${value%%[![:space:]]*}"}"
        value="${value%"${value##*[![:space:]]}"}"

        # Export it so child processes (dotnet, ssh) inherit it.
        export "$key=$value"
    done < "$file_path"
}

# Load all four layers for the given environment in precedence order.
load_env() {
    # Target environment — prod or staging.
    local environment="$1"

    # Resolve paths relative to this library's own directory, not the caller's CWD.
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # 1. Base defaults.
    load_env_file "$script_dir/.env.example"
    # 2. Env-specific defaults (ports).
    load_env_file "$script_dir/.env.$environment.example"
    # 3. Your secrets.
    load_env_file "$script_dir/.env"
    # 4. Your env-specific overrides.
    load_env_file "$script_dir/.env.$environment"

    # Warn if the secrets file is missing — the user still needs to create it.
    if [ ! -f "$script_dir/.env" ]; then
        echo "Warning: .env file not found. Copy .env.example to .env and configure your secrets." >&2
    fi
}
