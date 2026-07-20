"""User profile routes: get profile, upload avatar, upload & parse CV."""
import io
import json
import os
from pathlib import Path

import httpx
import PyPDF2
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/users", tags=["users"])

UPLOAD_DIR = Path(settings.upload_dir)
AVATARS_DIR = UPLOAD_DIR / "avatars"
CVS_DIR = UPLOAD_DIR / "cvs"
AVATARS_DIR.mkdir(parents=True, exist_ok=True)
CVS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_CV_TYPES = {"application/pdf"}


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str | None
    role: str
    avatar_path: str | None
    parsed_cv: dict | None

    class Config:
        from_attributes = True


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/avatar")
async def get_avatar(current_user: User = Depends(get_current_user)):
    if not current_user.avatar_path or not Path(current_user.avatar_path).exists():
        raise HTTPException(status_code=404, detail="No avatar uploaded")
    return FileResponse(current_user.avatar_path)


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, or GIF images allowed")

    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"user_{current_user.id}.{ext}"
    dest = AVATARS_DIR / filename

    content = await file.read()
    dest.write_bytes(content)

    # Reload user in session scope to update
    user = await session.get(User, current_user.id)
    user.avatar_path = str(dest)
    await session.commit()
    await session.refresh(user)
    return user


@router.post("/me/cv", response_model=UserOut)
async def upload_cv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if file.content_type not in ALLOWED_CV_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # 1. Read file into memory (no longer saving to disk)
    content = await file.read()

    # 2. Extract text with PyPDF2
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        resume_text = "\n".join(
            page.extract_text() or "" for page in reader.pages
        ).strip()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read PDF: {e}")

    if not resume_text:
        raise HTTPException(status_code=422, detail="PDF appears to be empty or image-only")

    # 3. Call GPT-5.5 to extract structured CV data
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured")

    prompt = f"""Extract structured information from the resume text below.

RESUME TEXT:
{resume_text[:8000]}"""

    cv_schema = {
        "type": "object",
        "properties": {
            "skills":       {"type": "array", "items": {"type": "string"}},
            "education": {
                "type": "object",
                "properties": {
                    "degree":      {"type": ["string", "null"]},
                    "institution": {"type": ["string", "null"]},
                    "year":        {"type": ["string", "null"]},
                },
                "required": ["degree", "institution", "year"],
                "additionalProperties": False,
            },
            "achievements": {"type": "array", "items": {"type": "string"}},
            "projects": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name":        {"type": "string"},
                        "description": {"type": "string"},
                    },
                    "required": ["name", "description"],
                    "additionalProperties": False,
                },
            },
            "job_keywords": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["skills", "education", "achievements", "projects", "job_keywords"],
        "additionalProperties": False,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-5.5",
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a CV parser. Extract skills, education, achievements, "
                                "projects, and job keywords from the resume. "
                                "job_keywords should include all job titles, roles, and technologies "
                                "this candidate should search for."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "parsed_cv",
                            "strict": True,
                            "schema": cv_schema,
                        },
                    },
                },
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {e.response.text[:300]}")

    try:
        parsed_cv = json.loads(resp.json()["choices"][0]["message"]["content"])
    except (KeyError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=502, detail=f"OpenAI returned unexpected response: {e}")

    # 4. Save parsed CV to DB
    user = await session.get(User, current_user.id)
    user.parsed_cv = parsed_cv
    await session.commit()
    await session.refresh(user)
    return user
