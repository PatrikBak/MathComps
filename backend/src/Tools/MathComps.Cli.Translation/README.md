# Translation Assistant

AI-powered translation of math problem statements and solutions. Preserves TeX formatting and mathematical notation while translating natural language text.

## How It Works

1. **Query Problems**: Finds problems needing translation in the target language
2. **AI Translation**: Sends each text to the LLM with instructions to translate natural language while preserving all TeX code
3. **Database Storage**: Saves translations with metadata tracking the translation date

## Usage

```bash
cd backend/src/Tools/MathComps.Cli.Translation

# Translate 10 problems to Czech
dotnet run -- translate-problems -n 10 -l CZ

# Translate only statements
dotnet run -- translate-problems -n 20 -l EN --scope StatementsOnly

# Translate only solutions
dotnet run -- translate-problems -n 15 -l SK --scope SolutionsOnly

# Force retranslation + parallel processing
dotnet run -- translate-problems -n 50 -l CZ --force --num-threads 5
```

**Options**:

- `-n|--count` – Number of problems to translate (required)
- `-l|--language` – Target language: `EN`, `CZ`, or `SK` (required)
- `--scope` – Translation scope: `Both` (default), `StatementsOnly`, or `SolutionsOnly`
- `--force` – Force retranslation even if translations exist
- `--num-threads` – Parallel threads (default: 1, watch rate limits)

## Setup

See the [main backend README](../../../README.md) for Gemini API and database setup.

## Configuration

Edit `appsettings.json` to change the AI model or prompt.
