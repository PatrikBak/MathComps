# Scripts

Convenience scripts for working with the production database locally via SSH tunnel.

## Setup

1. Copy `.env.example` to `.env` and fill in your SSH and database credentials:

   ```powershell
   cp .env.example .env
   ```

2. Edit `.env` with your actual values.

## Usage

### Opening the Database Tunnel

Start an SSH tunnel to the production database:

```powershell
.\Open-DbTunnel.ps1
```

This creates a local port forward that allows you to connect to the remote database as if it were running locally.

### Running Tools

Once the tunnel is open, use `Invoke-Tool.ps1` to run CLI tools against the production database:

```powershell
# Run database migrations
.\Invoke-Tool.ps1 migrate

# Seed the database
.\Invoke-Tool.ps1 seed

# Run other tools
.\Invoke-Tool.ps1 embeddings
.\Invoke-Tool.ps1 tagging
.\Invoke-Tool.ps1 translations
```

The script automatically configures the connection string using environment variables from `.env.example` and `.env` (`.env` overrides `.env.example`).

## Scripts

- **`Open-DbTunnel.ps1`** – Opens SSH tunnel to production database
- **`Invoke-Tool.ps1`** – Runs CLI tools with production database connection
- **`Import-Environment.ps1`** – Loads environment variables from `.env.example` and `.env` files
