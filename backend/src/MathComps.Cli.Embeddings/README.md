# Embeddings CLI

Generates vector embeddings for math problems using the Google Gemini API.

## How It Works

For each problem the tool embeds the statement and, when a solution exists, the statement with its solution. Each of those is embedded twice, once per task type, so a problem yields up to 4 vectors:

- `RETRIEVAL_QUERY` – for using the problem as a search query
- `RETRIEVAL_DOCUMENT` – for the corpus being searched against

Problems go to Gemini's batch embedding endpoint, `--batch-size` of them per call.

## Usage

```bash
# Generate embeddings for 5 problems
dotnet run --project backend/src/MathComps.Cli.Embeddings -- -n 5

# Force regeneration of existing embeddings for 10 problems
dotnet run --project backend/src/MathComps.Cli.Embeddings -- -n 10 --force

# Use a specific model with custom batch size
dotnet run --project backend/src/MathComps.Cli.Embeddings -- -n 100 --model gemini-embedding-001 --batch-size 50
```

**Options:**

- `-n|--count` – Number of problems to process (required)
- `-f|--force` – Force regeneration of existing embeddings
- `--model` – Gemini embedding model to use (default: `gemini-embedding-001`)
- `-b|--batch-size` – Number of problems to process in a single batch API call (default: 20)

## Setup

Database connection: see the [main backend README](../../README.md).

The tool requires a Gemini API key. Set it using .NET user secrets:

```bash
# From the Embeddings CLI directory
cd backend/src/MathComps.Cli.Embeddings

# Set the Gemini API key
dotnet user-secrets set "Gemini:ApiKey" "your-api-key-here"
```

## Database Schema

Embeddings are stored in the `problem_embeddings` table with the following structure:

- `problem_text_id`: Foreign key to the problem text being embedded (its `document_type` is `Statement` or `Solution`)
- `embedding_type`: The task type used (either `RETRIEVAL_QUERY` or `RETRIEVAL_DOCUMENT`)
- `model_name`: The model that generated the embedding (e.g., `gemini-embedding-001`)
- `embedding`: The vector embedding (1536 dimensions)
- `date_updated`: When the embedding was last generated

## API Reference

[Gemini Embeddings Documentation](https://ai.google.dev/gemini-api/docs/embeddings)
