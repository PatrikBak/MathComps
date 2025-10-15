# MathComps Embedding Service

A FastAPI service that generates vector embeddings for text using the `intfloat/multilingual-e5-base` model. It's a key component of the MathComps similarity system.

## How It Works

This service provides vector embeddings for text similarity calculations. It loads the E5 embedding model on startup and processes embedding requests with optional role prefixes for optimal performance.

1. **Model Loading**: Loads the E5 embedding model into memory on startup (~1GB RAM, ~2GB disk space)
2. **Embedding Generation**: Receives text lists and returns corresponding vector embeddings
3. **Role Optimization**: Supports `passage:` and `query:` prefixes for better embedding quality

## How to Run

```bash
cd backend/services/embedding-service

pip install -r requirements.txt
python app.py
```

The service will be available at `http://localhost:8000`.

## API Endpoints

### POST /embed

Generates vector embeddings for a list of texts.

**Request:**

```json
{
  "texts": ["Problem statement...", "Another one..."],
  "role": "passage"
}
```

**Response:**

```json
{
  "vectors": [
    [0.123, 0.456, ...],
    [0.789, 0.012, ...]
  ]
}
```

### GET /health

Checks service health and model status.

**Response:**

```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_name": "intfloat/multilingual-e5-base"
}
```

## Troubleshooting

- **First run slow**: Model download takes 1-2 minutes
- **Memory issues**: Ensure 1GB+ RAM available
- **Port conflicts**: Use `--port 8001` if port 8000 is busy
- **Model download fails**: Check internet connection and disk space (~2GB)

## Testing

```bash
# Health check
curl http://localhost:8000/health

# Generate embeddings
curl -X POST http://localhost:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"texts": ["Solve x^2 + 5x + 6 = 0"], "role": "passage"}'
```
