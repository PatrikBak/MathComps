"""
Embedding Model Wrapper

Provides a clean interface for generating text embeddings using the
sentence-transformers library with the multilingual E5 model.

This wrapper handles model loading, batch processing, and the E5-specific
role prefixing for optimal embedding quality.
"""

import logging
from typing import List, Optional, Tuple
import numpy as np

from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


class EmbeddingModel:
    """
    Wrapper for sentence-transformers model with E5-specific optimizations.

    Loads the multilingual E5 model once and provides methods for generating
    embeddings with proper role prefixing for passage vs query texts.
    """

    def __init__(self, model_name: str = "intfloat/multilingual-e5-base"):
        """
        Initialize the embedding model.

        Args:
            model_name: Name of the sentence-transformers model to load
        """
        self.model_name = model_name
        self.model: Optional[SentenceTransformer] = None
        self._load_model()

    def _load_model(self) -> None:
        """
        Load the sentence-transformers model.

        This method handles the model loading process and logs progress.
        """
        try:
            logger.info(f"Loading embedding model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            logger.info("Model loaded successfully")

            # Log model details for debugging
            logger.info(f"Model max sequence length: {self.model.get_max_seq_length()}")
            logger.info(
                f"Model dimensions: {self.model.get_sentence_embedding_dimension()}"
            )

        except Exception as e:
            logger.error(f"Failed to load model {self.model_name}: {e}")
            raise

    def is_ready(self) -> bool:
        """
        Check if the model is loaded and ready for use.

        Returns:
            True if model is loaded, False otherwise
        """
        return self.model is not None

    def generate_embeddings(
        self,
        texts: List[str],
        role: Optional[str] = None,
        batch_size: int = 32,
        normalize: bool = True,
    ) -> List[List[float]]:
        """
        Generate embeddings for a list of texts.

        Args:
            texts: List of text strings to embed
            role: Optional role for E5 model ("passage" or "query")
            batch_size: Batch size for processing
            normalize: Whether to normalize embeddings to unit length

        Returns:
            List of embedding vectors as lists of floats

        Raises:
            ValueError: If model is not loaded
            RuntimeError: If embedding generation fails
        """
        if not self.is_ready():
            raise ValueError("Model not loaded. Call _load_model() first.")

        if not texts:
            return []

        try:
            # Apply E5 role prefixing if specified
            processed_texts = self._apply_role_prefix(texts, role)

            logger.debug(f"Generating embeddings for {len(processed_texts)} texts")

            # Generate embeddings using sentence-transformers
            embeddings = self.model.encode(
                processed_texts,
                batch_size=batch_size,
                normalize_embeddings=normalize,
                show_progress_bar=False,
                convert_to_numpy=True,
            )

            # Convert numpy arrays to lists for JSON serialization
            return embeddings.tolist()

        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            raise RuntimeError(f"Embedding generation failed: {str(e)}")

    def generate_single_embedding(
        self, text: str, role: Optional[str] = None, normalize: bool = True
    ) -> List[float]:
        """
        Generate embedding for a single text.

        Convenience method for single text embedding.

        Args:
            text: Single text string to embed
            role: Optional role for E5 model
            normalize: Whether to normalize embeddings

        Returns:
            Single embedding vector as list of floats
        """
        result = self.generate_embeddings([text], role, normalize=normalize)
        return result[0] if result else []

    def _apply_role_prefix(self, texts: List[str], role: Optional[str]) -> List[str]:
        """
        Apply E5-specific role prefixes to texts.

        E5 models benefit from role prefixes:
        - "passage: " for documents/statements
        - "query: " for search queries

        Args:
            texts: Original text list
            role: Role to apply ("passage", "query", or None)

        Returns:
            Texts with role prefixes applied if role is specified
        """
        if not role:
            return texts

        if role not in ["passage", "query"]:
            logger.warning(f"Unknown role '{role}', ignoring role prefix")
            return texts

        prefix = f"{role}: "
        return [f"{prefix}{text}" for text in texts]

    def get_model_info(self) -> dict:
        """
        Get information about the loaded model.

        Returns:
            Dictionary containing model information
        """
        if not self.is_ready():
            return {"loaded": False}

        return {
            "loaded": True,
            "model_name": self.model_name,
            "max_sequence_length": self.model.get_max_seq_length(),
            "embedding_dimension": self.model.get_sentence_embedding_dimension(),
        }
