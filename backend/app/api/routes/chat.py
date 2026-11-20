import logging
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, status

from app.core.auth import get_current_user, AuthenticatedUser
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
    summary="Ask Automotive Question (Authenticated RAG Retrieval + Gemini)",
    description=(
        "Performs grounded question answering strictly using shared uploaded automotive brochures. "
        "Scopes session and message history strictly to the authenticated user's private session."
    ),
)
async def ask_automotive_question(
    request: ChatAskRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ChatAskResponse:
    """
    RAG-powered conversational endpoint.
    Verifies user identity from the JWT and isolates chat history to current_user.id.
    """
    if not request.question or not request.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The 'question' field cannot be empty or whitespace.",
        )

    # 1. Strict Automotive Intent Validation
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
            user_id=current_user.id,
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

    except PermissionError as perm_err:
        logger.warning("User %s attempted unauthorized access to session: %s", current_user.id, str(perm_err))
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to access another user's chat session.",
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
    "/sessions",
    summary="List Authenticated User's Private Chat Sessions",
    description="Returns all conversation sessions owned by the authenticated caller in reverse chronological order.",
)
async def list_user_sessions(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Returns private chat sessions for the authenticated user.
    """
    try:
        client = supabase_service.client
        res = (
            client.table("chat_sessions")
            .select("id, title, created_at, updated_at")
            .eq("user_id", str(current_user.id))
            .order("updated_at", desc=True)
            .execute()
        )
        return {
            "sessions": res.data or [],
            "count": len(res.data) if res.data else 0,
        }
    except Exception as exc:
        logger.error("Failed to list sessions for user %s: %s", current_user.id, str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load chat history.",
        )


@router.get(
    "/sessions/{session_id}/messages",
    summary="Get Chat Session Message History (Owner Only)",
    description="Retrieves chronological message history with citations. Strictly validates session ownership.",
)
async def get_session_messages(
    session_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Returns all conversational turns for the specified session.
    Strictly verifies that the caller owns the session; returns HTTP 403 otherwise.
    """
    client = supabase_service.client
    sess_id_str = str(session_id)

    try:
        # 1. Enforce session ownership verification
        sess_res = client.table("chat_sessions").select("id, user_id").eq("id", sess_id_str).execute()
        if not sess_res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found.")

        session = sess_res.data[0]
        # Check ownership: If session has a user_id, it must match current_user.id
        sess_owner = session.get("user_id")
        if sess_owner and str(sess_owner) != str(current_user.id):
            logger.warning("User %s attempted to view messages of session %s (owned by %s)", current_user.id, sess_id_str, sess_owner)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not have permission to access another user's chat messages.",
            )

        # 2. Fetch messages
        res = (
            client.table("chat_messages")
            .select("id, session_id, role, content, sources, created_at")
            .eq("session_id", sess_id_str)
            .order("created_at")
            .execute()
        )
        return {
            "session_id": sess_id_str,
            "message_count": len(res.data) if res.data else 0,
            "messages": res.data or [],
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to fetch messages for session %s: %s", sess_id_str, str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve chat session messages.",
        )


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Chat Session (Owner Only)",
)
async def delete_session(
    session_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Deletes a private chat session and all its messages.
    Strictly verifies ownership; returns HTTP 403 if caller is not the session owner.
    """
    client = supabase_service.client
    sess_id_str = str(session_id)

    try:
        sess_res = client.table("chat_sessions").select("id, user_id").eq("id", sess_id_str).execute()
        if not sess_res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found.")

        session = sess_res.data[0]
        sess_owner = session.get("user_id")
        if sess_owner and str(sess_owner) != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You cannot delete another user's chat session.",
            )

        client.table("chat_sessions").delete().eq("id", sess_id_str).execute()
        return {"success": True, "message": "Chat session deleted successfully."}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to delete session %s: %s", sess_id_str, str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete chat session.",
        )
