from fastapi import APIRouter
from .health import router as health_router
from .auth import router as auth_router
from .ai import router as ai_router
from .documents import router as documents_router
from .chat import router as chat_router
from .vehicles import router as vehicles_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(ai_router)
api_router.include_router(documents_router)
api_router.include_router(chat_router)
api_router.include_router(vehicles_router)

__all__ = ["api_router", "health_router", "auth_router", "ai_router", "documents_router", "chat_router", "vehicles_router"]
