import logging
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import AuthApiError

from app.services.supabase_service import supabase_service

logger = logging.getLogger("automotive_ai.auth")

security = HTTPBearer(auto_error=False)


class AuthenticatedUser(BaseModel):
    """
    Verified user identity model derived exclusively from verified Supabase access tokens.
    """
    id: UUID
    email: str
    full_name: str
    email_confirmed: bool


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> AuthenticatedUser:
    """
    FastAPI security dependency.
    Validates Supabase Bearer access tokens on every protected endpoint.
    - Validates token signature, issuance, and expiration.
    - Enforces email verification.
    - Derives user identity strictly from token claims.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials.strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token cannot be empty.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Validate token against Supabase Auth engine
        user_response = supabase_service.client.auth.get_user(token)
        user = user_response.user if user_response else None

        if not user or not user.id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session token. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Enforce email confirmation
        if not user.email_confirmed_at:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email verification required. Please verify your email before accessing the platform.",
            )

        meta = user.user_metadata or {}
        full_name = meta.get("full_name") or (user.email.split("@")[0] if user.email else "User")

        return AuthenticatedUser(
            id=UUID(user.id),
            email=user.email,
            full_name=full_name,
            email_confirmed=bool(user.email_confirmed_at),
        )

    except AuthApiError as auth_err:
        logger.warning("Supabase Auth API error during token validation: %s", auth_err.message)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {auth_err.message}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unexpected error validating authentication token: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session validation error. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
