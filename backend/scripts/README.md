# Scripts

Convenience scripts for working with staging and production databases locally via SSH tunnel.

## Setup

1. Copy `.env.example` to `.env` and fill in your SSH credentials:

   ```powershell
   cp .env.example .env
   ```

2. Edit `.env` with your actual values (SSH key path, host, password).

3. Create environment-specific overrides:
   ```powershell
   cp .env.prod.example .env.prod
   cp .env.staging.example .env.staging
   ```

## Usage

### Opening the Database Tunnel

Start an SSH tunnel to the database:

```powershell
# Production (default)
.\Open-DbTunnel.ps1

# Staging
.\Open-DbTunnel.ps1 -Env staging
```

### Running Tools

Once the tunnel is open, use `Invoke-Tool.ps1` to run CLI tools:

```powershell
# Run database migrations (production by default)
.\Invoke-Tool.ps1 migrate

# Seed the staging database
.\Invoke-Tool.ps1 -Env staging seed

# Other tools (use default launch profile)
.\Invoke-Tool.ps1 embeddings
.\Invoke-Tool.ps1 tagging
.\Invoke-Tool.ps1 translations

# Use a specific launch profile
.\Invoke-Tool.ps1 tagging -Profile "Veto Tags"
```

## Environment Loading Order

The scripts load environment variables in this order (later files override earlier):

1. `.env.example` — base defaults
2. `.env.{prod|staging}.example` — env-specific defaults (ports)
3. `.env` — your secrets (SSH key, passwords)
4. `.env.{prod|staging}` — your env-specific overrides (optional)

## Scripts

- **`Open-DbTunnel.ps1`** – Opens SSH tunnel to database
- **`Invoke-Tool.ps1`** – Runs CLI tools with database connection
- **`Import-Environment.ps1`** – Loads environment variables from `.env` files
