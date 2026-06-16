# MathComps Embeddings CLI

CLI tool for generating vector embeddings for math problems using the Google Gemini API.

## How It Works

This tool generates embeddings for problem statements and solutions using the Gemini API's embedding models. It supports:

1. **Multiple Document Types**:

   - Problem statement only
   - Problem statement with solution

2. **Multiple Task Types**:

   - `RETRIEVAL_QUERY` - Optimized for search queries (the problem you're searching with)
   - `RETRIEVAL_DOCUMENT` - Optimized for documents to be retrieved (problems in the database)

3. **Batch Processing**: Efficiently processes multiple problems with configurable batch sizes

## Usage

Runs from any directory — it finds its config and data from where the binary lives, not the working directory. The examples below use `dotnet run` from the tool's own folder; to run from elsewhere (e.g. the repo root), add `--project backend/src/MathComps.Cli.Embeddings`.

```bash
# Generate embeddings for 5 problems
dotnet run -- -n 5

# Force regeneration of existing embeddings for 10 problems
dotnet run -- -n 10 --force

# Use a specific model with custom batch size
dotnet run -- -n 100 --model gemini-embedding-001 --batch-size 50
```

**Options:**

- `-n|--count` – Number of problems to process (required)
- `-f|--force` – Force regeneration of existing embeddings
- `--model` – Gemini embedding model to use (default: `gemini-embedding-001`)
- `-b|--batch-size` – Number of problems to process in a single batch API call (default: 20)

## Setup

### Configuration

For database connection setup, see the [main backend README](../../README.md) for setup instructions.

### Gemini API Key

The tool requires a Gemini API key. Set it using .NET user secrets:

```bash
# From the Embeddings CLI directory
cd backend/src/MathComps.Cli.Embeddings

# Set the Gemini API key
dotnet user-secrets set "Gemini:ApiKey" "your-api-key-here"
```

## Embedding Strategy

For each problem, the tool generates up to 4 embeddings:

1. **Problem Statement + RETRIEVAL_QUERY**: For using the statement as a search query
2. **Problem Statement + RETRIEVAL_DOCUMENT**: For retrieving problems by statement
3. **Problem with Solution + RETRIEVAL_QUERY**: For using the full problem as a search query (if solution exists)
4. **Problem with Solution + RETRIEVAL_DOCUMENT**: For retrieving full problems (if solution exists)

This dual-type approach optimizes for both search queries and document retrieval:

- Use **RETRIEVAL_QUERY** embeddings when searching with a specific problem
- Use **RETRIEVAL_DOCUMENT** embeddings for the corpus of problems being searched against

## Database Schema

Embeddings are stored in the `problem_embeddings` table with the following structure:

- `problem_text_id`: Foreign key to the problem text being embedded (its `document_type` is `Statement` or `Solution`)
- `embedding_type`: The task type used (either `RETRIEVAL_QUERY` or `RETRIEVAL_DOCUMENT`)
- `model_name`: The model that generated the embedding (e.g., `gemini-embedding-001`)
- `embedding`: The vector embedding (1536 dimensions)
- `date_updated`: When the embedding was last generated

## API Reference

This tool uses the Gemini API's batch embedding endpoint. For more information, see:

- [Gemini Embeddings Documentation](https://ai.google.dev/gemini-api/docs/embeddings)
