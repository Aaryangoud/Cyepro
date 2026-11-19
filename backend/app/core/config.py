import os
import socket
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings

# Resolve path to backend/.env safely from file location
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE_PATH = BACKEND_DIR / ".env"

# Safe DNS fallback for Supabase Anycast to resolve ISP DNS spoofing/failures (e.g. ACT Fibernet in India)
_ORIG_GETADDRINFO = socket.getaddrinfo


def _patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    try:
        res = _ORIG_GETADDRINFO(host, port, family, type, proto, flags)
        if isinstance(host, str) and host.endswith(".supabase.co"):
            ips = [r[4][0] for r in res if len(r) > 4 and len(r[4]) > 0]
            # If resolved to an ISP blocking/redirect IP (e.g. 183.82.x.x) or loopback
            if any(ip.startswith("183.82.") or ip == "127.0.0.1" for ip in ips):
                return _ORIG_GETADDRINFO("172.64.149.246", port, family, type, proto, flags)
        return res
    except Exception:
        if isinstance(host, str) and host.endswith(".supabase.co"):
            return _ORIG_GETADDRINFO("172.64.149.246", port, family, type, proto, flags)
        raise


socket.getaddrinfo = _patched_getaddrinfo


class Settings(BaseSettings):
    PROJECT_NAME: str = "Automotive AI Assistant"
    API_V1_STR: str = "/api/v1"
    
    # Google Gemini API
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    EMBEDDING_MODEL: str = "gemini-embedding-001"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    EMBEDDING_DIMENSION: int = 768
    GEMINI_TIMEOUT_SECONDS: float = 60.0
    
    # Supabase / PostgreSQL Database
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    DATABASE_URL: Optional[str] = None
    SUPABASE_STORAGE_BUCKET: str = "automotive-brochures"
    
    # Security & Administration (read strictly from backend environment)
    ADMIN_API_KEY: Optional[str] = None
    
    # Server configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    
    # CORS Configuration: comma-separated list of allowed origins
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        """
        Parses comma-separated CORS_ORIGINS string into a list of origins.
        """
        if not self.CORS_ORIGINS:
            return ["http://localhost:3000", "http://127.0.0.1:3000"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    @property
    def clean_supabase_url(self) -> Optional[str]:
        """
        Returns normalized Supabase project URL without trailing /rest/v1 paths.
        """
        if not self.SUPABASE_URL:
            return None
        url = self.SUPABASE_URL.strip().rstrip("/")
        if url.endswith("/rest/v1"):
            url = url[:-len("/rest/v1")].rstrip("/")
        return url

    class Config:
        env_file = (str(ENV_FILE_PATH), ".env")
        case_sensitive = True
        extra = "ignore"


settings = Settings()
