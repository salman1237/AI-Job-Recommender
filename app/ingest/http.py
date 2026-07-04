import asyncio

import httpx

from app.config import settings

DEFAULT_TIMEOUT = httpx.Timeout(20.0, connect=10.0)


def make_client(**kwargs) -> httpx.AsyncClient:
    headers = {"User-Agent": settings.user_agent}
    headers.update(kwargs.pop("headers", {}))
    return httpx.AsyncClient(timeout=DEFAULT_TIMEOUT, headers=headers, **kwargs)


async def request_with_retry(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    retries: int = 3,
    backoff: float = 1.5,
    **kwargs,
) -> httpx.Response:
    """Issue a request with exponential backoff on transient errors (Phase 8)."""
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            resp = await client.request(method, url, **kwargs)
            # Retry on 429 / 5xx; raise on other 4xx.
            if resp.status_code in (429,) or resp.status_code >= 500:
                raise httpx.HTTPStatusError(
                    f"retryable status {resp.status_code}",
                    request=resp.request,
                    response=resp,
                )
            return resp
        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
            last_exc = exc
            if attempt < retries - 1:
                await asyncio.sleep(backoff ** attempt)
    raise last_exc  # type: ignore[misc]
