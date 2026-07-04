import re
from datetime import datetime

from dateutil import parser as dateparser

from app.ingest.base import Adapter, Normalized
from app.ingest.http import make_client, request_with_retry

# One adapter, four sites — parameterised by base URL + category id.
WP_SITES = [
    {
        "source": "opportunitydesk",
        "base": "https://opportunitydesk.org/wp-json/wp/v2",
        "type": "scholarship",
        "category": 6,
    },
    {
        "source": "opp4youth",
        "base": "https://opportunitiesforyouth.org/wp-json/wp/v2",
        "type": "scholarship",
        "category": 2,
    },
    {
        "source": "opp4africans",
        "base": "https://www.opportunitiesforafricans.com/wp-json/wp/v2",
        "type": "scholarship",
        "category": 12,
    },
    {
        "source": "uri_fellowships",
        "base": "https://web.uri.edu/fellowships/wp-json/wp/v2",
        "type": "fellowship",
        "category": 997,
    },
]

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def strip_html(html: str | None) -> str | None:
    if not html:
        return None
    text = _TAG_RE.sub(" ", html)
    text = (
        text.replace("&amp;", "&")
        .replace("&#8217;", "'")
        .replace("&#8211;", "-")
        .replace("&nbsp;", " ")
        .replace("&#038;", "&")
        .replace("&quot;", '"')
    )
    text = _WS_RE.sub(" ", text).strip()
    return text or None


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return dateparser.parse(value)
    except (ValueError, OverflowError, TypeError):
        return None


class WordPressAdapter(Adapter):
    """Standard WordPress wp/v2 REST adapter shared by all four WP sources."""

    PER_PAGE = 100
    MAX_PAGES = 50  # safety cap to avoid WordPress deep-pagination errors

    def __init__(self, source: str, base: str, type: str, category: int):
        self.source = source
        self.base = base.rstrip("/")
        self.type = type
        self.category = category

    async def fetch(self, since: datetime | None) -> list[Normalized]:
        results: list[Normalized] = []
        params: dict = {
            "categories": self.category,
            "per_page": self.PER_PAGE,
            "orderby": "date",
            "order": "desc",
        }
        if since is not None:
            # WordPress expects naive ISO-8601 in site/GMT time.
            params["after"] = since.replace(tzinfo=None).isoformat()

        async with make_client() as client:
            page = 1
            total_pages = 1
            while page <= total_pages and page <= self.MAX_PAGES:
                params["page"] = page
                resp = await request_with_retry(
                    client, "GET", f"{self.base}/posts", params=params
                )
                if resp.status_code == 400:
                    # Past the last available page window — stop cleanly.
                    break
                resp.raise_for_status()

                if page == 1:
                    total_pages = int(resp.headers.get("X-WP-TotalPages", "1") or "1")

                posts = resp.json()
                if not posts:
                    break
                for post in posts:
                    results.append(self._normalize(post))
                page += 1

        return results

    def _normalize(self, post: dict) -> Normalized:
        title = strip_html((post.get("title") or {}).get("rendered")) or "(untitled)"
        description = strip_html((post.get("content") or {}).get("rendered"))
        return Normalized(
            source=self.source,
            external_id=str(post.get("id")),
            type=self.type,
            title=title,
            url=post.get("link") or "",
            description=description,
            apply_url=post.get("link"),
            category=self.type,
            tags=[str(t) for t in (post.get("tags") or [])],
            posted_at=_parse_dt(post.get("date_gmt") or post.get("date")),
            raw=post,
        )


def wordpress_adapters() -> list[WordPressAdapter]:
    return [WordPressAdapter(**site) for site in WP_SITES]
