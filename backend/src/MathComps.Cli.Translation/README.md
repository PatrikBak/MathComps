# Translation Assistant

AI-powered translation of math problem statements and solutions. Preserves TeX formatting and mathematical notation while translating natural language text.

## Workflow

1. **`translate`** – AI translates problems and stores raw TeX in the database
2. **`parse`** – Parses raw TeX into structured JSON for rendering

## Commands

### `translate` - Generate Translations

Translates problems using AI (Gemini) and saves to database.

```bash
cd backend/src/MathComps.Cli.Translation

# Translate to all languages (EN, CZ) - default
dotnet run -- translate -n 100

# Translate to a specific language
dotnet run -- translate -n 100 -l EN

# Translate only statements
dotnet run -- translate -n 100 --scope StatementsOnly

# Force retranslation + parallel processing
dotnet run -- translate -n 100 --force --num-threads 4
```

**Options**:

- `-n|--count` – Number of problems to translate (required)
- `-l|--language` – Target language: `EN`, `CZ`, or `SK`. If omitted, translates to all languages (EN, CZ)
- `--scope` – Translation scope: `Both` (default), `StatementsOnly`, or `SolutionsOnly`
- `--force` – Force retranslation even if translations exist
- `--num-threads` – Parallel threads (default: 1, watch rate limits)

### `parse` - Parse Translations

Parses translated raw TeX text into structured JSON content. This step is required after translation to enable proper rendering.

```bash
# Parse all unparsed translations
dotnet run -- parse -n 100

# Parse only statements
dotnet run -- parse -n 100 --scope StatementsOnly
```

**Options**:

- `-n|--count` – Number of translations to parse (required)
- `--scope` – Parsing scope: `Both` (default), `StatementsOnly`, or `SolutionsOnly`

**Error Recovery**:

If any translations fail to parse (due to malformed TeX or unknown commands), they are written to `Output/parse-issues.yaml`. YAML is used for easier editing of multiline TeX content. To fix:

1. Edit the `rawText` field in the file to correct the TeX
2. Rerun the parse command

When a manually fixed entry parses successfully, both `ParsedText` and `RawText` are updated in the database. This ensures your fixes are persisted permanently and won't need to be applied again.

## Setup

See the [main backend README](../../../README.md) for Gemini API and database setup.

## Configuration

Edit `appsettings.json` to change the AI model or prompt for translations.
