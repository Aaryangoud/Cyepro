from fastapi import APIRouter, status
from app.models.schemas import AppHealthResponse, DatabaseHealthResponse
from app.core.config import settings
from app.services.supabase_service import supabase_service

router = APIRouter(prefix="/health", tags=["Health"])


@router.get(
    "",
    response_model=AppHealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Application Health Check",
    description="Returns the operational status, service name, and version of the Automotive AI Assistant API.",
)
async def get_application_health() -> AppHealthResponse:
    """
    Lightweight health endpoint for uptime and orchestrator monitoring.
    """
    return AppHealthResponse(
        status="online",
        api_name=settings.PROJECT_NAME,
        version="1.0.0",
    )


@router.get(
    "/database",
    response_model=DatabaseHealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Database Connection Health Check",
    description="Executes a live query to verify connectivity and latency with the Supabase PostgreSQL database.",
)
async def get_database_health() -> DatabaseHealthResponse:
    """
    Validates live connection to Supabase database without exposing sensitive credentials.
    """
    result = supabase_service.check_connection()
    return DatabaseHealthResponse(
        status=result["status"],
        database=result["database"],
        latency_ms=result["latency_ms"],
        error=result["error"],
    )
