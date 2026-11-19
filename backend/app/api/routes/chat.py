import logging
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, HTTPException, status

from app.models.schemas import (
    ChatAskRequest,
    ChatAskResponse,
    ChatSource,
)
from app.rag import rag_service
from app.services.supabase_service import supabase_service
from app.services.intent_service import intent_service, REJECTION_MESSAGE

router = APIRouter(prefix="/chat", tags=["Automotive RAG Chat"])
logger = logging.getLogger("automotive_ai.chat_api")


@router.post(
    "/ask",
    response_model=ChatAskResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask Automotive Question (RAG Retrieval + Gemini)",
    description=(
        "Performs grounded question answering strictly using uploaded automotive brochures: "
        "embeds the question, retrieves top relevant chunks from Supabase pgvector using cosine similarity, "
        "synthesizes a verified factual answer via Google Gemini with strict anti-hallucination constraints, "
        "and persists the conversational turn in Supabase chat tables."
    ),
)
async def ask_automotive_question(request: ChatAskRequest) -> ChatAskResponse:
    """
    RAG-powered conversational endpoint for vehicle inquiries, specifications, features, and comparisons.
    """
    if not request.question or not request.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The 'question' field cannot be empty or whitespace.",
        )

    # 1. Strict Automotive Intent Validation
    # Runs before generating embeddings, vector DB retrieval, or Gemini answer generation
    is_automotive, reason = intent_service.classify_automotive_intent(request.question)
    if not is_automotive:
        logger.info("Non-automotive query rejected ('%s'): %s", request.question[:80], reason)
        return ChatAskResponse(
            success=True,
            status="rejected",
            question=request.question,
            answer=REJECTION_MESSAGE,
            session_id=str(request.session_id) if request.session_id else None,
            sources=[],
            chunks_retrieved=0,
            confidence_score=None,
            is_fallback=False,
            message=REJECTION_MESSAGE,
        )

    try:
        result = rag_service.ask(
            question=request.question,
            session_id=request.session_id,
            vehicle_id=request.vehicle_id,
            top_k=request.top_k or 5,
            similarity_threshold=request.similarity_threshold or 0.4,
            model=request.model,
        )

        return ChatAskResponse(
            success=True,
            status=result.get("status", "accepted"),
            question=result["question"],
            answer=result["answer"],
            session_id=result["session_id"],
            sources=result["sources"],
            chunks_retrieved=result["chunks_retrieved"],
            confidence_score=result["confidence_score"],
            is_fallback=result.get("is_fallback", False),
            message=result["message"],
        )

    except ValueError as val_err:
        logger.warning("RAG query validation error: %s", str(val_err))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except RuntimeError as run_err:
        logger.error("RAG execution runtime error: %s", str(run_err))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(run_err),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unexpected error in /chat/ask: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating the automotive answer.",
        )


@router.get(
    "/sessions/{session_id}/messages",
    summary="Get Chat Session Message History",
    description="Retrieves chronological message history with citations for a given chat session.",
)
async def get_session_messages(session_id: UUID):
    """
    Returns all conversational turns and sources recorded for the specified session.
    """
    try:
        client = supabase_service.client
        res = (
            client.table("chat_messages")
            .select("id, session_id, role, content, sources, created_at")
            .eq("session_id", str(session_id))
            .order("created_at")
            .execute()
        )
        return {
            "session_id": str(session_id),
            "message_count": len(res.data) if res.data else 0,
            "messages": res.data or [],
        }
    except Exception as exc:
        logger.error("Failed to fetch messages for session %s: %s", str(session_id), str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve chat session messages.",
        )
