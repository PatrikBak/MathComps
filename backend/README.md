# MathComps Backend

The .NET backend for the MathComps application. Includes a Web API and CLI tools for data processing, parsing, and AI-powered features.

## Structure

- **`src/Api/MathComps.Api`** – Main Web API
  - See the [API README](src/Api/MathComps.Api/README.md) for setup and running instructions
- **`src/Core/`** – Domain models and parsing logic
- **`src/Infrastructure/`** – Database, EF Core, and data access
  - **`Resources/`** – Shared metadata files (e.g., `approved-tags.json`, `metadata.*.json`)
- **`src/Shared/`** – Shared utilities and common code
  - **`ResourcePaths.cs`** – Centralized paths to shared resources
- **`src/Tools/`** – CLI tools for data processing (see below)

### Shared Resources

Metadata files in `src/Infrastructure/MathComps.Infrastructure/Resources/` are embedded and copied to output directories, making them available to both the API and CLI tools at runtime via `ResourcePaths` constants.

### Localization

The API supports multiple languages via the `Accept-Language` HTTP header. The frontend sends this header with each request, and the backend uses it to return localized content.

**How it works:**

- **Request Localization Middleware** (`Program.cs`) – Parses `Accept-Language` header and sets `CurrentCulture`
- **Endpoint Extensions** – Helper methods extract the detected language for service calls

**Key localization files in `Resources/`:**

| File                     | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| `metadata.{locale}.json` | Localized competition names, round labels, etc. |
| `approved-tags.json`     | Tag vocabulary with English slugs (canonical)   |

**Problem translations:**

Problem statements and solutions are stored in the `problem_texts` table with per-language entries. The original language is marked, and AI-generated translations are created using the [Translation Assistant CLI](src/Tools/MathComps.Cli.Translation/README.md). The API returns problem text in the requested language, falling back to the original if unavailable.

**Adding a new language:**

1. Create `metadata.{locale}.json` with translated competition/round names
2. Update `SupportedLanguages` in the codebase
3. Run the Translation Assistant to generate problem translations
4. The API will automatically serve content based on `Accept-Language`

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

### 3. Configure Gemini API (Optional)

For AI-powered tools (tagging, translation, embeddings), set up your Gemini API key:

```bash
# From the backend directory
cd backend

# Set Gemini API key (shared across all tools)
dotnet user-secrets set "Gemini:ApiKey" "your-gemini-api-key" --project src/Api/MathComps.Api
```

Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 4. Configure Clerk Webhooks (Optional)

For user authentication and synchronization, configure the Clerk webhook secret:

```bash
# From the API directory
cd backend/src/Api/MathComps.Api

# Set Clerk webhook secret
dotnet user-secrets set "Clerk:WebhookSecret" "your-clerk-webhook-secret"
dotnet user-secrets set "Clerk:ClientSecret" "your-clerk-client-secret"
```

The webhook endpoint synchronizes user data from Clerk to the local database. For details about events handled and testing instructions, see the [API README](src/Api/MathComps.Api/README.md#webhooks).

### 5. Run the API

See the [API README](src/Api/MathComps.Api/README.md) for running instructions.

## CLI Tools

Command-line tools for data processing, parsing, and AI features. Each tool has its own README with detailed instructions.

### Data Pipeline Tools

- **[SKMO Parser](src/Tools/MathComps.Cli.SkmoParser/README.md)** – Parses raw `.tex` archive into structured JSON
- **[Database Seeder](src/Tools/MathComps.Cli.DatabaseSeeder/README.md)** – Populates database from parsed JSON
- **[SKMO Scraper](src/Tools/MathComps.Cli.SkmoScraper/README.md)** – Scrapes solution links from SKMO website and updates database with these links

### AI-Powered Tools

- **[Tagging Assistant](src/Tools/MathComps.Cli.Tagging/README.md)** – AI-powered problem categorization with Gemini
- **[Translation Assistant](src/Tools/MathComps.Cli.Translation/README.md)** – AI-powered problem translation with Gemini
- **[Embeddings CLI](src/Tools/MathComps.Cli.Embeddings/README.md)** – Gemini-based vector embedding generator
- **[Similarity System](src/Tools/MathComps.Cli.Similarity/README.md)** – Problem similarity calculation using embeddings + tags and other things

### Content Tools

- **[Handouts Parser](src/Tools/MathComps.Cli.Handouts/README.md)** – Converts `.tex` handouts to `.json` for frontend

## Adding New Problems

Step-by-step workflow for adding new SKMO problems. All `Invoke-Tool` commands assume you're in `backend/scripts/` with the DB tunnel open.

### 1. Add to Archive

Edit the correct `.tex` file in `data/skmo/Archive/<year>/`:

- `zadania.tex` for problem statements
- `riesenia.tex` for solutions

### 2. Parse the Archive

```powershell
# From backend/src/Tools/MathComps.Cli.SkmoParser
dotnet run -c Release
```

### 3. Seed the Database

```powershell
.\Invoke-Tool.ps1 seed --skip-existing
```

### 4. Generate Translations

```powershell
.\Invoke-Tool.ps1 translations translate --count 100
```

Translates to all languages (EN, CZ) by default.

### 5. Parse Translations

```powershell
.\Invoke-Tool.ps1 translations parse --count 100 --scope StatementsOnly
```

Parses the raw TeX in translations to generate structured content. If any translations fail to parse, they are written to `Output/parse-issues.yaml`. To fix: edit the file and rerun.

### 6. Generate Embeddings

```powershell
.\Invoke-Tool.ps1 embeddings
```

### 7. Generate Tags

```powershell
.\Invoke-Tool.ps1 tagging
```

### 8. Veto Tags (Optional)

```powershell
.\Invoke-Tool.ps1 tagging -Profile "Veto Tags"
```

Useful when tagging many problems, as manual adjustments can be tedious.

### 9. Manual Tag Adjustment

```powershell
.\Invoke-Tool.ps1 tagging interactive
```

### 10. Scrape SKMO Links (If Needed)

If new solution PDFs are available on the SKMO website (using the correct):

```powershell
# From backend/src/Tools/MathComps.Cli.SkmoScraper
dotnet run -c Release -- scrape --start-year 75 --end-year 75
```

Remark: Update 75 to the current year.

### 11. Update Solution Links

```powershell
.\Invoke-Tool.ps1 update-links
```

## Deployment

The backend supports separate **staging** and **production** environments using Docker Compose override files.

### Quick Start

```bash
# Start production
./deploy.sh prod up -d

# Start staging
./deploy.sh staging up -d

# Stop staging (saves resources)
./deploy.sh staging down

# View logs
./deploy.sh prod logs -f api
```

### Environment Setup

1. Copy the base example file to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your shared values

3. Create environment-specific overrides:

   ```bash
   cp .env.prod.example .env.prod        # For production
   cp .env.staging.example .env.staging  # For staging
   ```

4. Edit the override files with environment-specific values (`DOMAIN`)

5. Create `appsettings.{Production|Staging}.json` with CORS origins (gitignored)

## Development

### Code Formatting

Format code using `dotnet format`:

```bash
# From the backend directory
cd backend
dotnet format
```
