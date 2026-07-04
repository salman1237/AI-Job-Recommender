from dataclasses import dataclass, field
from datetime import date, datetime
import hashlib
import json


@dataclass
class Normalized:
    """The single internal shape every adapter maps its source records into."""

    source: str
    external_id: str
    type: str  # 'job' | 'scholarship' | 'fellowship' | 'grant' | 'internship' | 'other'
    title: str
    url: str
    organization: str | None = None
    description: str | None = None
    apply_url: str | None = None
    location: str | None = None
    country: str | None = None
    category: str | None = None
    tags: list = field(default_factory=list)
    salary: str | None = None
    deadline: date | None = None
    posted_at: datetime | None = None
    raw: dict | None = None

    def content_hash(self) -> str:
        """Fingerprint of the meaningful fields — used to detect edits."""
        key = json.dumps(
            [
                self.title,
                self.organization,
                self.description,
                self.deadline.isoformat() if self.deadline else None,
                self.url,
            ],
            ensure_ascii=False,
        )
        return hashlib.sha256(key.encode()).hexdigest()


class Adapter:
    """Base class for all source adapters."""

    source: str

    async def fetch(self, since: datetime | None) -> list[Normalized]:
        raise NotImplementedError
