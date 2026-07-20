"""Auth router: Register (with OTP verification) and Login endpoints."""
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import OTPVerification, PasswordResetToken, User
from app.security import create_access_token, hash_password, verify_password
from app.services.email_service import send_otp_email, send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])

OTP_TTL_MINUTES = 10
RESET_TOKEN_TTL_MINUTES = 15


class SendOtpRequest(BaseModel):
    email: EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    otp: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    token: str
    new_password: str


@router.post("/send-otp", status_code=status.HTTP_200_OK)
async def send_otp(body: SendOtpRequest, session: AsyncSession = Depends(get_session)):
    """Generate a 6-digit OTP and email it. Rejects already-registered addresses."""
    existing = await session.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Invalidate any previous unused OTPs for this address
    await session.execute(
        update(OTPVerification)
        .where(OTPVerification.email == body.email, OTPVerification.is_used.is_(False))
        .values(is_used=True)
    )

    otp = str(secrets.randbelow(1_000_000)).zfill(6)
    session.add(OTPVerification(
        email=body.email,
        otp=otp,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
    ))
    await session.commit()

    await send_otp_email(body.email, otp)
    return {"message": "OTP sent. Check your inbox."}


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)):
    """Create an account. Requires a valid OTP that was emailed to the address."""
    existing = await session.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    now = datetime.now(timezone.utc)
    otp_record = await session.scalar(
        select(OTPVerification).where(
            OTPVerification.email == body.email,
            OTPVerification.otp == body.otp,
            OTPVerification.is_used.is_(False),
            OTPVerification.expires_at > now,
        )
    )
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP. Request a new one.")

    otp_record.is_used = True

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    token = create_access_token(user.id, user.email, user.role)
    return TokenResponse(access_token=token)


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(body: ForgotPasswordRequest, session: AsyncSession = Depends(get_session)):
    """Send a 6-digit reset code to the email. Always returns success to avoid email enumeration."""
    user = await session.scalar(select(User).where(User.email == body.email))
    if user:
        await session.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.email == body.email, PasswordResetToken.is_used.is_(False))
            .values(is_used=True)
        )
        token = str(secrets.randbelow(1_000_000)).zfill(6)
        session.add(PasswordResetToken(
            email=body.email,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
        ))
        await session.commit()
        await send_password_reset_email(body.email, token)
    return {"message": "If that email is registered, a reset code has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(body: ResetPasswordRequest, session: AsyncSession = Depends(get_session)):
    """Verify reset token and update the user's password."""
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")
    now = datetime.now(timezone.utc)
    token_record = await session.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.email == body.email,
            PasswordResetToken.token == body.token,
            PasswordResetToken.is_used.is_(False),
            PasswordResetToken.expires_at > now,
        )
    )
    if not token_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code. Please request a new one.")
    user = await session.scalar(select(User).where(User.email == body.email))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.hashed_password = hash_password(body.new_password)
    token_record.is_used = True
    await session.commit()
    return {"message": "Password reset successfully. You can now sign in."}


@router.post("/login", response_model=TokenResponse)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session),
):
    user = await session.scalar(select(User).where(User.email == form.username))
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    token = create_access_token(user.id, user.email, user.role)
    return TokenResponse(access_token=token)
