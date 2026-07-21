from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class OpportunityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    external_id: str
    type: str
    title: str
    organization: str | None = None
    description: str | None = None
    url: str
    apply_url: str | None = None
    location: str | None = None
    country: str | None = None
    category: str | None = None
    tags: list = []
    salary: str | None = None
    deadline: date | None = None
    posted_at: datetime | None = None
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class OpportunityDetail(OpportunityOut):
    raw: dict | None = None


class OpportunityList(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[OpportunityOut]


class CandidateProfile(BaseModel):
    """The extracted resume JSON sent by the client for re-ranking."""
    skills: list[str] = []
    education: dict = {}
    achievements: list[str] = []
    projects: list[dict] = []
    job_keywords: list[str] = []


class RerankedOpportunity(OpportunityOut):
    """An opportunity enriched with an AI-generated match score and reason."""
    match_score: int = 0
    match_reason: str = ""


class RerankedList(BaseModel):
    total: int
    cached: bool = False
    items: list[RerankedOpportunity]


class SourceCount(BaseModel):
    source: str
    count: int


class SourceStat(BaseModel):
    source: str
    count: int
    last_success: datetime | None = None
    last_status: str | None = None


class Stats(BaseModel):
    total: int
    active: int
    by_type: dict[str, int]
    sources: list[SourceStat]
    total_users: int = 0


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    started_at: datetime | None = None
    finished_at: datetime | None = None
    fetched: int
    created: int
    updated: int
    status: str | None = None
    error: str | None = None


class IngestResult(BaseModel):
    status: str
    detail: str


class EmailLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    user_email: str | None = None
    email_type: str
    status: str
    error_message: str | None = None
    sent_at: datetime


class SavedSearchCreate(BaseModel):
    name: str
    keywords: str | None = None
    opp_type: str | None = None
    country: str | None = None


class SavedSearchUpdate(BaseModel):
    name: str | None = None
    notify_enabled: bool | None = None


class SavedSearchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    keywords: str | None
    opp_type: str | None
    country: str | None
    notify_enabled: bool
    last_alerted_at: datetime | None
    created_at: datetime
