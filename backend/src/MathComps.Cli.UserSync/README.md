# User Sync CLI

Syncs all users from Clerk to the MathComps database. Reach for it when a new column landed on the User table, or when webhooks failed to fire for some users.

## How It Works

1. Fetches all users from Clerk using the Backend API
2. For each user, creates a `UserSyncDto` with the user's data from Clerk
3. Calls `IUserManager.SyncUserAsync()` to upsert the user in the database

The sync is **idempotent**.

## Usage

```bash
dotnet run --project backend/src/MathComps.Cli.UserSync
```

## Setup

Before running, ensure your Clerk secret key is configured. See the [main backend README](../../README.md) for setup instructions.
