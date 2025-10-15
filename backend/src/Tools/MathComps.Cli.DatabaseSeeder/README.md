# Database Seeder CLI

This tool populates the MathComps database from a pre-parsed JSON data source.

## How It Works

The seeder is designed to be used whenever new data is added to the archive. When you run it, it performs the following steps:

1.  **Reads Data Source**: Loads all problem data from `data/skmo/archive.parsed.json`, which is the output of the `SkmoProblems` CLI tool.
2.  **Upserts Metadata**: Scans the data and ensures all related metadata (competitions, rounds, seasons, categories, authors) exists in the database. Creates any missing entries.
3.  **Processes Images**: Finds all images referenced in problem statements and solutions, copies them to the public `wwwroot` directory, and records their metadata.
4.  **Upserts Problems**: Adds or updates each problem in the database, linking it to the correct metadata and images.

The entire process is **idempotent**, meaning you can run it multiple times without creating duplicate data.

## Command Reference

All commands must be run from the tool's directory as it uses relative paths.

```bash
# Navigate to the tool's directory
cd backend/src/Tools/MathComps.Cli.DatabaseSeeder
```

### **seed**

Seeds the database with problems from the parsed JSON dataset.

```bash
# Full sync - insert new problems and update existing ones (default)
dotnet run -- seed

# Skip existing - only insert new problems, skip updates (much faster)
dotnet run -- seed --skip-existing
```

## Setup

Before running, configure your database connection string in user secrets. See the [main backend README](../../../README.md) for setup instructions.
