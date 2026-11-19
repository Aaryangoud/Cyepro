import time
from typing import Optional, Dict, Any
from supabase import create_client, Client
from postgrest.exceptions import APIError
from app.core.config import settings


class SupabaseService:
    """
    Service layer for managing the Supabase client and database interactions.
    """

    def __init__(self) -> None:
        self._client: Optional[Client] = None

    @property
    def client(self) -> Client:
        """
        Initializes and returns a singleton Supabase client using configured credentials.
        Raises RuntimeError if required credentials are not configured.
        """
        if self._client is None:
            url = settings.clean_supabase_url
            key = settings.SUPABASE_KEY

            if not url or not key:
                raise RuntimeError(
                    "Supabase configuration missing: SUPABASE_URL and SUPABASE_KEY must be set in backend/.env"
                )

            self._client = create_client(url, key)

        return self._client

    def is_configured(self) -> bool:
        """
        Checks if required Supabase configuration parameters exist.
        """
        return bool(settings.clean_supabase_url and settings.SUPABASE_KEY)

    def check_connection(self) -> Dict[str, Any]:
        """
        Executes a real lightweight database connectivity check against Supabase.
        Returns a dictionary with connection status, latency, and sanitized error info.
        """
        if not self.is_configured():
            return {
                "status": "disconnected",
                "database": "Supabase PostgreSQL",
                "latency_ms": None,
                "error": "Supabase credentials are not configured in environment variables.",
            }

        start_time = time.time()
        try:
            # Query the database through the official Supabase SDK
            response = self.client.table("vehicles").select("id", count="exact").limit(0).execute()
            latency = round((time.time() - start_time) * 1000, 2)
            return {
                "status": "connected",
                "database": "Supabase PostgreSQL",
                "latency_ms": latency,
                "error": None,
            }
        except APIError as api_err:
            latency = round((time.time() - start_time) * 1000, 2)
            # Handle PostgreSQL permission warning gracefully if service_role table grants are pending
            if api_err.code == "42501":
                return {
                    "status": "connected",
                    "database": "Supabase PostgreSQL",
                    "latency_ms": latency,
                    "error": (
                        "Database reachable. Notice: Table permissions pending. "
                        "Execute 'GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;' in Supabase SQL Editor."
                    ),
                }
            return {
                "status": "disconnected",
                "database": "Supabase PostgreSQL",
                "latency_ms": latency,
                "error": f"Supabase API Error ({api_err.code}): {api_err.message}",
            }
        except Exception as exc:
            return {
                "status": "disconnected",
                "database": "Supabase PostgreSQL",
                "latency_ms": None,
                "error": f"Connection error: {type(exc).__name__}",
            }


# Reusable singleton instance
supabase_service = SupabaseService()
