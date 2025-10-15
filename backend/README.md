# MathComps Backend

The .NET backend for the MathComps application. Includes a Web API and CLI tools for data processing, parsing, and AI-powered features.

## Structure

- **`src/Api/MathComps.Api`** – Main Web API
  - See the [API README](src/Api/MathComps.Api/README.md) for setup and running instructions
- **`src/Core/`** – Domain models and parsing logic
- **`src/Infrastructure/`** – Database, EF Core, and data access
- **`src/Shared/`** – Shared utilities and common code
- **`src/Tools/`** – CLI tools for data processing (see below)

## Getting Started

### 0. Database Requirements

This application requires **PostgreSQL with the pgvector extension** for AI-powered similarity search features.

#### Quick Setup with Docker (Recommended)

```bash
# Start PostgreSQL with pgvector
docker run --name mathcomps-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d pgvector/pgvector:pg17

# Verify the extension is available
docker exec -it mathcomps-postgres psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

#### Local PostgreSQL Installation

If you prefer a local installation:

1. Install PostgreSQL 16+
2. Install the pgvector extension: https://github.com/pgvector/pgvector#installation
3. Verify the extension is available:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

### 1. Configure Database Connection

Set up your database connection string using .NET user secrets:

```bash
# We need a directory with a .csproj
cd backend/src/Api/MathComps.Api

# Set the value of the connection string
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Database=mathcomps;Username=postgres;Password=postgres"
```

**Remark**: The command above uses the Api project, but the user secrets key is shared for all backend projects (see [`Directory.Build.props`](Directory.Build.props)), so the connection string will be available everywhere.

### 2. Create Database Schema

If creating an empty DB from scratch, apply Entity Framework migrations:

```bash
# From the DB project directory
cd backend/src/Infrastructure/MathComps.Infrastructure

# Run the migration tool
dotnet ef database update
```

This will create the database schema including the required PostgreSQL extensions (pgvector).

**Creating new migrations:**

When you modify the data model, create a new migration from the Infrastructure directory:

```bash
# From the Infrastructure directory
cd backend/src/Infrastructure/MathComps.Infrastructure
dotnet ef migrations add <MigrationName> --startup-project ../../Api/MathComps.Api
```

### 3. Run the API

See the [API README](src/Api/MathComps.Api/README.md) for running instructions.

## CLI Tools

Command-line tools for data processing, parsing, and AI features. Each tool has its own README with detailed instructions.

### Data Pipeline Tools

- **[SKMO Problems Parser](src/Tools/MathComps.Cli.SkmoProblems/README.md)** – Parses raw `.tex` archive into structured JSON
- **[Database Seeder](src/Tools/MathComps.Cli.DatabaseSeeder/README.md)** – Populates database from parsed JSON
- **[SKMO Scraper](src/Tools/MathComps.Cli.SkmoScraper/README.md)** – Scrapes solution links from SKMO website and updates database with these links

### AI-Powered Tools

- **[Similarity System](src/Tools/MathComps.Cli.Similarity/README.md)** – Semantic search using embeddings and metadata
- **[Tagging Assistant](src/Tools/MathComps.Cli.Tagging/README.md)** – LLM-powered problem categorization

### Content Tools

- **[Handouts Parser](src/Tools/MathComps.Cli.Handouts/README.md)** – Converts `.tex` handouts to `.json` for frontend

## Development

### Code Formatting

Format code using `dotnet format`:

```bash
# From the backend directory
cd backend
dotnet format
```
