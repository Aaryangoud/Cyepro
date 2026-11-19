import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, status

from app.models.schemas import (
    VehicleCompareRequest,
    VehicleCompareResponse,
)
from app.services.vehicle_comparison_service import vehicle_comparison_service
from app.services.supabase_service import supabase_service

router = APIRouter(prefix="/vehicles", tags=["Vehicle Specifications & Comparison"])
logger = logging.getLogger("automotive_ai.vehicles_api")


@router.post(
    "/compare",
    response_model=VehicleCompareResponse,
    status_code=status.HTTP_200_OK,
    summary="Compare Two Vehicles (Side-by-Side Specifications + AI Trade-Off Analysis)",
    description=(
        "Compares two vehicles across 8 key specification categories (powertrain, fuel type, mileage, "
        "dimensions, seating capacity, safety, infotainment/comfort, and price) strictly grounded in "
        "uploaded official brochures. Generates a neutral comparison summary and cites source pages."
    ),
)
async def compare_vehicles(request: VehicleCompareRequest) -> VehicleCompareResponse:
    """
    Side-by-side vehicle comparison endpoint with strict anti-hallucination and source citation.
    """
    if not request.vehicle_1 or not request.vehicle_1.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The 'vehicle_1' field is required and cannot be empty.",
        )
    if not request.vehicle_2 or not request.vehicle_2.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The 'vehicle_2' field is required and cannot be empty.",
        )

    try:
        response = vehicle_comparison_service.compare(request)
        return response

    except ValueError as val_err:
        logger.warning("Vehicle comparison validation notice: %s", str(val_err))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as exc:
        logger.error("Unexpected error in /vehicles/compare: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating the vehicle comparison.",
        )


@router.get(
    "/",
    summary="List Registered Vehicles and Available Brochures",
    description="Returns available vehicles registered in the database and uploaded brochures ready for comparison.",
)
async def list_vehicles():
    """
    Helper endpoint returning all vehicles and ingested documents available for inquiries and comparisons.
    """
    try:
        client = supabase_service.client
        docs_res = client.table("documents").select("id, file_name, storage_path, file_size, total_pages, processing_status, created_at").execute()
        vehicles_res = client.table("vehicles").select("id, manufacturer, model_name").execute()

        return {
            "vehicles_count": len(vehicles_res.data) if vehicles_res.data else 0,
            "vehicles": vehicles_res.data or [],
            "documents_count": len(docs_res.data) if docs_res.data else 0,
            "documents": docs_res.data or [],
        }
    except Exception as exc:
        logger.error("Failed to list vehicles: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve vehicle list from database.",
        )
