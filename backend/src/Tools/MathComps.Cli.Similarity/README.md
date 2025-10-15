# MathComps AI Similarity System (not in prod yet)

CLI tool for finding similar math problems using semantic embeddings and metadata matching.

## How It Works

The system calculates similarity in a multi-step process:

1. **Load Problem Data**: Fetches the source problem's text, solution, tags, and competition info.
2. **Generate Embeddings**: If missing, it calls a Python service to create vector embeddings for the problem's text and solution. These are saved to the database.
3. **Find Candidates**: To work efficiently, it first finds a smaller pool of _candidate_ problems by filtering the entire database. Candidates must:
   - Belong to a similar competition (i.e. same difficulty level).
   - Share at least one tag with the source problem.
   - Meet a minimum threshold of semantic similarity.
4. **Calculate & Score**: It then calculates a detailed similarity score for each candidate using a weighted average of multiple factors.
5. **Store Results**: The final similarity scores are saved to the database.

## Similarity Algorithm

Similarity is calculated in two stages:

### 1. Candidate Filtering

Instead of comparing against every problem, we first select relevant candidates using a combination of fast database queries:

- **Competition Clustering**: Problems are grouped by difficulty or type (e.g., national vs. international). Competition similarity scores are defined in `appsettings.json` under `CompetitionClusterMap`. We only consider candidates from the same or adjacent clusters.
- **Tag Overlap**: Candidates must share at least one tag with the source problem.
- **Semantic Similarity**: A baseline vector search finds problems that are at least somewhat semantically similar.

### 2. Weighted Scoring

Each candidate is then scored based on a weighted combination of signals defined in `appsettings.json`:

- **Statement Similarity**: Cosine distance between statement embeddings.
- **Solution Similarity**: Cosine distance between solution embeddings. If a solution is missing, its weight is redistributed among the other factors.
- **Tag Similarity**: Jaccard index measuring the overlap of problem tags.
- **Competition Similarity**: A score based on how "close" the competitions are in the cluster map. It's more nuanced than a simple "same/different" check.

## Command Reference

All commands must be run from the tool's directory as it uses relative paths to access configuration files.

```bash
# Navigate to the tool's directory
cd backend/src/Tools/MathComps.Cli.Similarity
```

### **calculate-similarities**

Calculates similarity scores for problems.

```bash
# Calculate similarities for 100 problems
dotnet run -- calculate-similarities -n 100

# Generate embeddings only (safe preprocessing)
dotnet run -- calculate-similarities -n 100 --embeddings-only

# Skip problems with existing similarities
dotnet run -- calculate-similarities -n 50 --skip-processed
```

- `--count` or `-n`: Number of problems to process.
- `--embeddings-only`: Only generate embeddings without calculating similarities.
- `--skip-processed`: Skip problems that already have similarities calculated.

### **interactive**

Starts an interactive session to manually manage similarity relationships.

```bash
dotnet run -- interactive
```

- **Commands**: List, view, or remove similarity relationships.

## Setup

### Configuration

For database connection setup, see the [main backend README](../../../README.md) for setup instructions.

### Embedding Service

The similarity system requires a Python embedding service to generate vector representations of problems. See the [Embedding Service README](../../../../services/embedding-service/README.md) for setup and running instructions.

### Configuration Options

All configuration is in `appsettings.json`:

- **TotalCandidateLimit**: Maximum number of candidates to consider per problem.
- **MinimalSimilarity**: Minimum similarity threshold for candidates.
- **SimilarityWeights**: Weights for statement, solution, tag, and competition similarity.
- **CompetitionClusterMap**: Difficulty scores for each competition (0-10 scale).
- **CompetitionTolerance**: Maximum cluster distance for candidate filtering.

See `appsettings.json` for current values and adjust as needed for your use case.
