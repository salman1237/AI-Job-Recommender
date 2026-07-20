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
_TH_TD_RE = re.compile(r"<th[^>]*>(.*?)</th>.*?<td[^>]*>(.*?)</td>", re.DOTALL | re.IGNORECASE)

# Keys that indicate organisation in a WP table
_ORG_KEYS = {
    "host organisation", "host organization", "organization", "organisation",
    "awarding body", "scholarship provider", "offered by", "programme provider",
    "host institution", "institution", "program provider", "grant provider",
    "fellowship provider", "sponsor",
}
# Keys that indicate location/country in a WP table
_LOC_KEYS = {
    "host country", "host countries", "country", "countries", "location",
    "venue", "open to", "eligible countries", "participating countries",
    "open to students from", "nationality",
}
# Category slugs too generic to use as country
_SKIP_CATS = {
    "africa", "america", "asia", "europe", "australia", "all",
    "scholarships", "fellowships", "fellowships-and-scholarships",
    "bachelor", "master", "phd", "short-term-travel", "internship",
    "research-study-abroad", "graduate", "undergraduate",
    "fellowship-grant",
}

# Matches "Deadline: <date>" in multiple formats including ordinal suffixes (1st, 3rd, 22nd).
_DEADLINE_RE = re.compile(
    r"deadline\s*[:\-]\s*"
    r"(?:"
    r"(\w+\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})"       # "Oct 15, 2026" / "June 3rd, 2026"
    r"|(\d{1,2}(?:st|nd|rd|th)?\.?\s+\w+\.?[,\s]+\d{4})"  # "15 Oct 2026" / "3rd June, 2025"
    r"|(\d{4}-\d{2}-\d{2})"                                 # "2026-10-15"
    r"|(\d{1,2}/\d{1,2}/\d{4})"                             # "10/15/2026"
    r")",
    re.IGNORECASE,
)


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


def _parse_deadline(html: str | None) -> "date | None":
    if not html:
        return None
    # 1. Table extraction (e.g. opp4youth: <th>Deadline</th><td>20 August 2026</td>)
    fields = _parse_table_fields(html)
    for key, val in fields.items():
        if "deadline" in key and val:
            try:
                dt = dateparser.parse(val.strip(), dayfirst=True)
                if dt:
                    return dt.date()
            except (ValueError, OverflowError, TypeError):
                pass
    # 2. Regex on raw HTML (inline: <strong>Deadline: Oct 15, 2026</strong>)
    m = _DEADLINE_RE.search(html)
    if not m:
        # 3. Regex on stripped plain text (handles split tags like
        #    <strong>Deadline:</strong> <strong>20 August 2026</strong>)
        m = _DEADLINE_RE.search(strip_html(html) or "")
    if not m:
        return None
    raw = next(g for g in m.groups() if g)
    try:
        dt = dateparser.parse(raw.strip(), dayfirst=False)
        return dt.date() if dt else None
    except (ValueError, OverflowError, TypeError):
        return None


def _parse_table_fields(html: str | None) -> dict[str, str]:
    """Extract {lower-cased th label → stripped td text} from all HTML tables."""
    if not html:
        return {}
    result: dict[str, str] = {}
    for m in _TH_TD_RE.finditer(html):
        key = (strip_html(m.group(1)) or "").lower().strip()
        val = (strip_html(m.group(2)) or "").strip()
        if key and val:
            result[key] = val
    return result


def _parse_organization(html: str | None) -> str | None:
    """Try to extract the awarding organisation from content HTML."""
    fields = _parse_table_fields(html)
    for key, val in fields.items():
        if key in _ORG_KEYS:
            return val[:250]
    if not html:
        return None
    text = strip_html(html) or ""
    m = re.search(
        r"(?:host\s+organ[iz]ation|organ[iz]ation|awarding\s+body|offered\s+by)\s*:\s*([^\n]{3,200})",
        text, re.IGNORECASE,
    )
    return m.group(1).strip()[:250] if m else None


def _parse_location(html: str | None, class_list=None) -> str | None:
    """Try to extract location/country from content HTML, then from WP class_list."""
    fields = _parse_table_fields(html)
    for key, val in fields.items():
        if key in _LOC_KEYS:
            return val[:300]
    if html:
        text = strip_html(html) or ""
        m = re.search(
            r"(?:host\s+countr(?:y|ies)|location|countr(?:y|ies)|venue|open\s+to)\s*:\s*([^\n]{3,250})",
            text, re.IGNORECASE,
        )
        if m:
            return m.group(1).strip()[:300]
    # Fall back: find the first meaningful category-* class
    if class_list:
        items: list[str] = (
            list(class_list.values()) if isinstance(class_list, dict) else class_list
        )
        for cls in items:
            if not isinstance(cls, str):
                continue
            if cls.startswith("category-"):
                slug = cls[9:]
                if slug not in _SKIP_CATS:
                    return slug.replace("-", " ").title()
    return None


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
    MAX_PAGES = 3  # Reduced to 3 to prevent 60-second cloud serverless timeout

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
        content_html = (post.get("content") or {}).get("rendered")
        description = strip_html(content_html)
        class_list = post.get("class_list")
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
            organization=_parse_organization(content_html),
            location=_parse_location(content_html, class_list),
            deadline=_parse_deadline(content_html),
            posted_at=_parse_dt(post.get("date_gmt") or post.get("date")),
            raw=post,
        )


def wordpress_adapters() -> list[WordPressAdapter]:
    return [WordPressAdapter(**site) for site in WP_SITES]
