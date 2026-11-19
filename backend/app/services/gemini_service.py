import logging
import time
from typing import Optional, List
from google import genai
from google.genai import types
from google.genai.errors import APIError, ClientError

from app.core.config import settings

logger = logging.getLogger("automotive_ai.gemini")


class GeminiService:
    """
    Reusable service for Google Gemini text generation and vector embeddings
    using the official Google Gen AI Python SDK.
    """

    def __init__(self) -> None:
        self._client: Optional[genai.Client] = None

    @property
    def client(self) -> genai.Client:
        """
        Initializes and returns a cached genai.Client instance.
        Raises RuntimeError if GEMINI_API_KEY is not configured.
        """
        if self._client is None:
            api_key = settings.GEMINI_API_KEY
            if not api_key:
                raise RuntimeError("GEMINI_API_KEY is not configured in backend/.env")
            self._client = genai.Client(api_key=api_key)
        return self._client

    def is_configured(self) -> bool:
        """
        Returns True if the Gemini API key is configured.
        """
        return bool(settings.GEMINI_API_KEY)

    def generate_text(
        self,
        prompt: str,
        model: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
    ) -> str:
        """
        Generates text completion using the specified or default Gemini model.

        :param prompt: Text input prompt.
        :param model: Optional override for Gemini model.
        :param timeout_seconds: Optional request timeout in seconds.
        :return: Generated string response.
        """
        cleaned_prompt = prompt.strip() if prompt else ""
        if not cleaned_prompt:
            raise ValueError("Prompt cannot be empty or whitespace.")

        selected_model = model or settings.GEMINI_MODEL
        timeout_ms = int((timeout_seconds or settings.GEMINI_TIMEOUT_SECONDS) * 1000)

        config = types.GenerateContentConfig(
            http_options=types.HttpOptions(timeout=timeout_ms)
        )

        candidate_models = [selected_model]
        for fallback in ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"]:
            if fallback not in candidate_models:
                candidate_models.append(fallback)

        last_error = None
        for current_model in candidate_models:
            try:
                response = self.client.models.generate_content(
                    model=current_model,
                    contents=cleaned_prompt,
                    config=config,
                )

                if response.text and response.text.strip():
                    return response.text.strip()

            except (ClientError, APIError, Exception) as e:
                logger.warning("Generation attempt with %s failed (%s). Trying fallback...", current_model, str(e)[:120])
                last_error = e
                time.sleep(1.5)

        if isinstance(last_error, ClientError):
            raise RuntimeError(f"Gemini API request failed: {last_error.message}") from last_error
        elif isinstance(last_error, APIError):
            raise RuntimeError(f"Gemini service error: {last_error.message}") from last_error
        elif last_error:
            raise RuntimeError(f"Gemini text generation failed: {type(last_error).__name__}") from last_error

        raise RuntimeError("Gemini returned an empty response across all models.")

    def embed_text(
        self,
        text: str,
        model: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
    ) -> List[float]:
        """
        Generates a 768-dimensional dense vector embedding for input text.

        :param text: Text string to embed.
        :param model: Optional embedding model override.
        :param timeout_seconds: Optional request timeout in seconds.
        :return: List of exactly 768 float values.
        """
        cleaned_text = text.strip() if text else ""
        if not cleaned_text:
            raise ValueError("Input text for embedding cannot be empty or whitespace.")

        selected_model = model or settings.EMBEDDING_MODEL
        timeout_ms = int((timeout_seconds or settings.GEMINI_TIMEOUT_SECONDS) * 1000)
        expected_dims = settings.EMBEDDING_DIMENSION

        config = types.EmbedContentConfig(
            output_dimensionality=expected_dims,
            http_options=types.HttpOptions(timeout=timeout_ms),
        )

        try:
            response = self.client.models.embed_content(
                model=selected_model,
                contents=cleaned_text,
                config=config,
            )

            if not response.embeddings or len(response.embeddings) == 0:
                raise RuntimeError("Gemini returned no embeddings for the provided content.")

            embedding_values = response.embeddings[0].values
            if len(embedding_values) != expected_dims:
                raise ValueError(
                    f"Vector dimension mismatch: expected {expected_dims}, received {len(embedding_values)}"
                )

            return [float(val) for val in embedding_values]

        except (ClientError, APIError) as e:
            logger.error("Gemini embedding API error: %s", str(e))
            raise RuntimeError(f"Gemini embedding API error: {e.message}") from e
        except ValueError:
            raise
        except Exception as e:
            logger.error("Unexpected error in Gemini embedding generation: %s", type(e).__name__)
            raise RuntimeError("An unexpected error occurred during Gemini embedding generation.") from e

    def embed_batch(
        self,
        texts: List[str],
        model: Optional[str] = None,
        batch_size: int = 10,
        timeout_seconds: Optional[float] = None,
    ) -> List[List[float]]:
        """
        Generates 768-dimensional vector embeddings for multiple texts in manageable batches
        using a single Gemini API call per batch to optimize throughput and avoid rate limits.

        :param texts: List of text strings to embed.
        :param model: Optional embedding model override.
        :param batch_size: Number of texts per Gemini API call (default 10).
        :param timeout_seconds: Optional request timeout in seconds.
        :return: List of 768-dimensional float vectors corresponding to inputs.
        """
        if not texts:
            return []

        selected_model = model or settings.EMBEDDING_MODEL
        expected_dims = settings.EMBEDDING_DIMENSION
        timeout_ms = int((timeout_seconds or settings.GEMINI_TIMEOUT_SECONDS) * 1000)

        config = types.EmbedContentConfig(
            output_dimensionality=expected_dims,
            http_options=types.HttpOptions(timeout=timeout_ms),
        )

        all_embeddings: List[List[float]] = []

        # Process in batches of batch_size
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            cleaned_batch = [t.strip() if t else "" for t in batch]

            try:
                response = self.client.models.embed_content(
                    model=selected_model,
                    contents=cleaned_batch,
                    config=config,
                )

                if not response.embeddings or len(response.embeddings) != len(cleaned_batch):
                    raise RuntimeError(
                        f"Gemini returned {len(response.embeddings) if response.embeddings else 0} embeddings "
                        f"for batch of size {len(cleaned_batch)}"
                    )

                for idx, emb in enumerate(response.embeddings):
                    if len(emb.values) != expected_dims:
                        raise ValueError(
                            f"Vector dimension mismatch at item {idx}: expected {expected_dims}, "
                            f"received {len(emb.values)}"
                        )
                    all_embeddings.append([float(val) for val in emb.values])

            except (ClientError, APIError) as e:
                logger.error("Gemini batch embedding API error: %s", str(e))
                raise RuntimeError(f"Gemini embedding API error: {e.message}") from e
            except ValueError:
                raise
            except Exception as e:
                logger.error("Unexpected error in Gemini batch embedding: %s", type(e).__name__)
                raise RuntimeError("An unexpected error occurred during Gemini batch embedding.") from e

        return all_embeddings

    def embed_chunks(
        self,
        chunks: List[str],
        model: Optional[str] = None,
    ) -> List[List[float]]:
        """
        Reusable batch embedding utility for document chunk processing.
        Delegates to embed_batch for optimal API efficiency and quota preservation.
        """
        if not chunks:
            return []
        cleaned = [c for c in chunks if c and c.strip()]
        return self.embed_batch(cleaned, model=model, batch_size=10)


# Reusable singleton instance
gemini_service = GeminiService()
