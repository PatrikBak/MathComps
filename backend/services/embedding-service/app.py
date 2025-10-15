"""
MathComps Embedding Service

A FastAPI service that provides semantic vector embeddings for mathematical problems
and their solutions using the multilingual E5 model. This service supports both
individual text embedding and batch processing for efficient similarity calculations.

The service uses the intfloat/multilingual-e5-base model which provides high-quality
embeddings for multiple languages including English, Czech, and Slovak.
"""

from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import logging

from embedding_model import EmbeddingModel

# Configure logging for better debugging and monitoring
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global model instance - loaded once at startup
embedding_model: Optional[EmbeddingModel] = None


class EmbedRequest(BaseModel):
    """
    Request model for embedding generation.

    Supports both single texts and batches, with optional role specification
    for E5 model conventions (passage vs query).
    """

    texts: List[str] = Field(..., min_items=1, description="Texts to embed")
    role: Optional[str] = Field(None, description="Role for E5 model (passage/query)")


class EmbedResponse(BaseModel):
    """
    Response model containing generated embeddings.

    Returns vectors as lists of floats for easy JSON serialization.
    """

    vectors: List[List[float]] = Field(..., description="Generated vector embeddings")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for FastAPI application.

    Handles model loading at startup and cleanup at shutdown.
    """
    global embedding_model

    logger.info("Starting embedding service...")

    try:
        # Load the embedding model at startup
        embedding_model = EmbeddingModel()
        logger.info("Embedding model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load embedding model: {e}")
        raise

    yield

    logger.info("Shutting down embedding service...")


# Create FastAPI application with lifespan management
app = FastAPI(
    title="MathComps Embedding Service",
    description="Semantic embedding service for mathematical problems using multilingual E5 model",
    version="1.0.0",
    lifespan=lifespan,
)


@app.post("/embed", response_model=EmbedResponse)
async def embed_texts(request: EmbedRequest) -> EmbedResponse:
    """
    Generate vector embeddings for the provided texts.

    This endpoint processes texts using the pre-loaded multilingual E5 model
    and returns semantic vector representations suitable for similarity calculations.

    Args:
        request: Request containing texts to embed and optional role

    Returns:
        Response containing vector embeddings for all input texts

    Raises:
        HTTPException: If embedding generation fails
    """
    if not request.texts:
        raise HTTPException(status_code=400, detail="texts list cannot be empty")

    try:
        logger.info(f"Processing {len(request.texts)} texts for embedding")

        # Generate embeddings using the global model instance
        vectors = embedding_model.generate_embeddings(
            texts=request.texts, role=request.role
        )

        logger.info(f"Successfully generated {len(vectors)} embeddings")
        return EmbedResponse(vectors=vectors)

    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        raise HTTPException(
            status_code=500, detail=f"Embedding generation failed: {str(e)}"
        )


@app.get("/health")
async def health_check() -> dict:
    """
    Health check endpoint for monitoring service status.

    Returns the status of the embedding model and service readiness.
    """
    model_ready = embedding_model is not None and embedding_model.is_ready()
    return {
        "status": "healthy" if model_ready else "unhealthy",
        "model_loaded": model_ready,
        "model_name": "intfloat/multilingual-e5-base",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
