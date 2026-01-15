# Translation Assistant

AI-powered translation of math problem statements and solutions. Preserves TeX formatting and mathematical notation while translating natural language text.

## How It Works

1. **Query Problems**: Finds problems needing translation in the target language(s)
2. **AI Translation**: Sends each text to the LLM with instructions to translate natural language while preserving all TeX code
3. **Database Storage**: Saves translations with metadata tracking the translation date

## Usage

```bash
cd backend/src/Tools/MathComps.Cli.Translation

# Translate to all languages (EN, CZ) - default
dotnet run -- -n 100

# Translate to a specific language
dotnet run -- -n 100 -l EN

# Translate only statements
dotnet run -- -n 100 --scope StatementsOnly

# Force retranslation + parallel processing
dotnet run -- -n 100 --force --num-threads 4
```

**Options**:

- `-n|--count` – Number of problems to translate (required)
- `-l|--language` – Target language: `EN`, `CZ`, or `SK`. If omitted, translates to all languages (EN, CZ)
- `--scope` – Translation scope: `Both` (default), `StatementsOnly`, or `SolutionsOnly`
- `--force` – Force retranslation even if translations exist
- `--num-threads` – Parallel threads (default: 1, watch rate limits)

## Setup

See the [main backend README](../../../README.md) for Gemini API and database setup.

## Configuration

Edit `appsettings.json` to change the AI model or prompt.
