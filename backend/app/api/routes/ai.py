from fastapi import APIRouter, HTTPException, status
from app.models.schemas import (
    GenerateRequest,
    GenerateResponse,
    EmbedRequest,
    EmbedResponse,
)
from app.services.gemini_service import gemini_service
from app.core.config import settings

router = APIRouter(prefix="/ai", tags=["AI & Embeddings"])


@router.post(
    "/generate",
    response_model=GenerateResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Text with Google Gemini",
    description="Generates text completion using the configured Google Gemini model.",
)
async def generate_text(request: GenerateRequest) -> GenerateResponse:
    """
    Generate text using Google Gemini API.
    """
    if not gemini_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini AI service is not configured. Please set GEMINI_API_KEY in backend/.env",
        )

    try:
        generated_text = gemini_service.generate_text(
            prompt=request.prompt,
            model=request.model,
        )
        return GenerateResponse(
            success=True,
            response=generated_text,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except RuntimeError as run_err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(run_err),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate text from Gemini service.",
        )


@router.post(
    "/embed",
    response_model=EmbedResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate 768-dim Vector Embedding",
    description="Generates a 768-dimensional dense vector embedding using gemini-embedding-001.",
)
async def generate_embedding(request: EmbedRequest) -> EmbedResponse:
    """
    Generate dense vector embedding matching Supabase pgvector column dimensions.
    """
    if not gemini_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini AI service is not configured. Please set GEMINI_API_KEY in backend/.env",
        )

    try:
        embedding_vector = gemini_service.embed_text(
            text=request.text,
        )
        return EmbedResponse(
            success=True,
            dimensions=len(embedding_vector),
            embedding=embedding_vector,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except RuntimeError as run_err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(run_err),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate vector embedding from Gemini service.",
        )
