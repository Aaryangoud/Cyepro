import logging
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from fastapi import APIRouter, HTTPException, Depends, status
from supabase import AuthApiError, create_client, Client

from fastapi.security import HTTPAuthorizationCredentials
from app.core.config import settings
from app.core.auth import get_current_user, AuthenticatedUser, security
from app.services.supabase_service import supabase_service

logger = logging.getLogger("automotive_ai.auth_api")

router = APIRouter(prefix="/auth", tags=["Authentication & User Management"])

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


def _get_auth_client() -> Client:
    """
    Returns an isolated Supabase client for authentication flows (signup, login, reset).
    This ensures that user sessions do not mutate or taint the singleton backend supabase_service.client,
    which must always remain the service-role admin client.
    """
    url = settings.clean_supabase_url
    key = settings.SUPABASE_KEY
    return create_client(url, key)


class SignUpRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="User's full name")
    email: str = Field(..., pattern=EMAIL_PATTERN, description="Valid email address")
    password: str = Field(..., min_length=8, max_length=128, description="Strong password (min 8 chars)")
    confirm_password: str = Field(..., min_length=8, max_length=128, description="Confirm password matching password")

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match.")
        return v


class LoginRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_PATTERN, description="Registered email address")
    password: str = Field(..., min_length=1, description="Account password")


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_PATTERN, description="Registered email address to receive reset link")
    redirect_to: Optional[str] = Field(None, description="Optional redirect URL for password reset")


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128, description="New password (min 8 chars)")
    confirm_password: str = Field(..., min_length=8, max_length=128, description="Confirm new password")

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match.")
        return v


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="Updated display name")


class AuthResponse(BaseModel):
    success: bool = True
    message: str
    user_id: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    email_confirmed: bool = False


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New User Account",
    description="Registers a new user in Supabase Auth with Full Name, Email, and Password. Sends verification email.",
)
async def signup(request: SignUpRequest) -> AuthResponse:
    try:
        auth_client = _get_auth_client()
        res = auth_client.auth.sign_up({
            "email": request.email.strip().lower(),
            "password": request.password,
            "options": {
                "data": {
                    "full_name": request.full_name.strip(),
                }
            }
        })

        user = res.user if res else None
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Signup failed. Please check your credentials.",
            )

        session = res.session if res else None
        is_confirmed = bool(user.email_confirmed_at)

        msg = (
            "Account registered successfully. Please check your email to verify your account before logging in."
            if not is_confirmed
            else "Account created and verified successfully."
        )

        return AuthResponse(
            success=True,
            message=msg,
            user_id=str(user.id),
            email=user.email,
            full_name=request.full_name.strip(),
            access_token=session.access_token if session else None,
            refresh_token=session.refresh_token if session else None,
            expires_in=session.expires_in if session else None,
            email_confirmed=is_confirmed,
        )

    except AuthApiError as e:
        logger.warning("Signup error from Supabase: %s", e.message)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unexpected signup error: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating your account.",
        )


@router.post(
    "/login",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate User with Email & Password",
    description="Logs in an authenticated user via Supabase Auth and returns JWT Bearer tokens.",
)
async def login(request: LoginRequest) -> AuthResponse:
    try:
        auth_client = _get_auth_client()
        res = auth_client.auth.sign_in_with_password({
            "email": request.email.strip().lower(),
            "password": request.password,
        })

        user = res.user if res else None
        session = res.session if res else None

        if not user or not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        # Enforce email confirmation
        if not user.email_confirmed_at:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email verification required. Please click the confirmation link sent to your email before logging in.",
            )

        meta = user.user_metadata or {}
        full_name = meta.get("full_name") or user.email.split("@")[0]

        return AuthResponse(
            success=True,
            message="Login successful.",
            user_id=str(user.id),
            email=user.email,
            full_name=full_name,
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            expires_in=session.expires_in,
            email_confirmed=True,
        )

    except AuthApiError as e:
        logger.warning("Login failed for '%s': %s", request.email, e.message)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=e.message)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unexpected login error: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during authentication.",
        )


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    summary="Request Password Reset Link",
    description="Sends a password reset email via Supabase Auth to the specified email address.",
)
async def forgot_password(request: ForgotPasswordRequest):
    try:
        opts = {}
        if request.redirect_to:
            opts["redirect_to"] = request.redirect_to
        auth_client = _get_auth_client()
        auth_client.auth.reset_password_for_email(request.email.strip().lower(), options=opts if opts else None)
        return {
            "success": True,
            "message": "If an account exists with this email, a password reset link has been dispatched.",
        }
    except Exception as exc:
        logger.error("Forgot password error: %s", str(exc))
        # Keep response neutral to prevent email enumeration
        return {
            "success": True,
            "message": "If an account exists with this email, a password reset link has been dispatched.",
        }


@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
    summary="Update Password (Authenticated Recovery Session)",
    description="Updates the user's password using the active authenticated recovery session.",
)
async def reset_password(
    request: ResetPasswordRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """
    Validates the password recovery token using Supabase Auth.
    Strictly derives the target user ID exclusively from the verified token.
    Never trusts client-supplied IDs, preventing cross-user password resets.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password reset requires a valid recovery authorization token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials.strip()
    try:
        # Validate recovery token directly with Supabase Auth using isolated client
        user_response = _get_auth_client().auth.get_user(token)
        user = user_response.user if user_response else None

        if not user or not user.id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired password recovery token. Please request a new reset link.",
            )

        # Target user ID derived exclusively from the cryptographic token claims
        target_user_id = str(user.id)

        # Update password for this verified user only
        supabase_service.client.auth.admin.update_user_by_id(
            target_user_id,
            {"password": request.new_password}
        )

        logger.info("Password successfully updated for user %s via recovery token.", target_user_id)
        return {
            "success": True,
            "message": "Password updated successfully. You can now log in with your new password.",
        }

    except AuthApiError as auth_err:
        logger.warning("Recovery token verification failed: %s", auth_err.message)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired password recovery token. Please request a new reset link.",
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Reset password failed: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update password. Please request a new reset link.",
        )


@router.get(
    "/me",
    summary="Get Authenticated User Profile",
    description="Returns verified user profile and identity information for the active session.",
)
async def get_me(current_user: AuthenticatedUser = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "email_confirmed": current_user.email_confirmed,
    }


@router.patch(
    "/profile",
    summary="Update Authenticated User Profile",
    description="Updates the authenticated user's display name.",
)
async def update_profile(
    request: UpdateProfileRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        user_id = str(current_user.id)
        new_name = request.full_name.strip()
        
        # 1. Update Supabase Auth user metadata
        supabase_service.client.auth.admin.update_user_by_id(
            user_id,
            {"user_metadata": {"full_name": new_name}}
        )
        
        # 2. Update profiles table
        supabase_service.client.table("profiles").update(
            {"full_name": new_name}
        ).eq("id", user_id).execute()
        
        logger.info("Profile updated for user %s -> '%s'", user_id, new_name)
        return {
            "success": True,
            "message": "Display name updated successfully.",
            "full_name": new_name,
        }
    except Exception as exc:
        logger.error("Failed to update profile: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update profile display name.",
        )
