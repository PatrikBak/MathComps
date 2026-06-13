# User Sync CLI

This tool syncs all users from Clerk to the MathComps database.

## Purpose

Use this tool when you need to force-sync user data from Clerk to the database. This is useful when:

- A new feature was added, e.g. a new column to the User table
- Webhooks failed to fire for some users

## Usage

```bash
# Navigate to the tool's directory
cd backend/src/MathComps.Cli.UserSync

# Run the sync
dotnet run
```

## How It Works

1. Fetches all users from Clerk using the Backend API
2. For each user, creates a `UserSyncDto` with the user's data from Clerk
3. Calls `IUserManager.SyncUserAsync()` to upsert the user in the database

The sync is **idempotent** - running it multiple times is safe and will simply update existing records.

## Setup

Before running, ensure your Clerk secret key is configured. See the [main backend README](../../../README.md) for setup instructions.
