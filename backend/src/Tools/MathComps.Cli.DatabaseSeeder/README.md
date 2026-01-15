# Database Seeder CLI

This tool populates the MathComps database from a pre-parsed JSON data source.

## How It Works

The seeder is designed to be used whenever new data is added to the archive. When you run it, it performs the following steps:

1.  **Reads Data Source**: Loads all problem data from `data/skmo/archive.parsed.json`, which is the output of the `SkmoParser` CLI tool.
2.  **Upserts Metadata**: Scans the data and ensures all related metadata (competitions, rounds, seasons, categories, authors) exists in the database. Creates any missing entries.
3.  **Processes Images**: Finds all images referenced in problem statements and solutions, copies them to the public `wwwroot` directory, and records their metadata.
4.  **Upserts Problems**: Adds or updates each problem in the database, linking it to the correct metadata and images.

The entire process is **idempotent**, meaning you can run it multiple times without creating duplicate data.

## Usage

All commands must be run from the tool's directory as it uses relative paths.

```bash
# Navigate to the tool's directory
cd backend/src/Tools/MathComps.Cli.DatabaseSeeder

# Full sync: insert new and update existing (default)
dotnet run

# Skip existing: only insert new problems (faster for adding new years)
dotnet run -- --skip-existing

# Process only specific year(s)
dotnet run -- 75
dotnet run -- 72 59 41
```

**Options:**

- `-s|--skip-existing` – Skip updating existing problems (only insert new ones)

**Arguments:**

- `[years]...` – Optional positional arguments specifying which year(s) to process. If not provided, all years are processed. Multiple years can be specified space-separated (e.g., `72 59 41`)

## Setup

Before running, configure your database connection string in user secrets. See the [main backend README](../../../README.md) for setup instructions.
