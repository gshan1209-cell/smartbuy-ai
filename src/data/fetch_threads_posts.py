"""Fetch public Threads posts for the agricultural news pipeline.

Playwright imports remain local to the crawler entry point so normal API
processes do not load browser automation dependencies.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
from html import unescape
import json
import logging
import os
import re
from typing import Any, Iterator
from urllib.parse import quote, urlparse


THREADS_USERNAME = os.getenv("THREADS_USERNAME", "abc89151207").strip().lstrip("@")
THREADS_SOURCE_NAME = "農民日常（Threads）"
THREADS_PROFILE_URL = "https://www.threads.net/@abc89151207?hl=zh-tw"
THREADS_MAX_THREADS = 10
THREADS_PAGE_TIMEOUT_MS = 45000
THREADS_DETAIL_DELAY_SECONDS = 1.0

_TAIPEI_TZ = timezone(timedelta(hours=8))
_LOGGER = logging.getLogger(__name__)
_APPLICATION_JSON_PATTERN = re.compile(
    r'<script\s+[^>]*type=["\']application/json["\'][^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)
_LEADING_DECORATION_PATTERN = re.compile(
    r"^[\s\U0001F000-\U0001FAFF\u2600-\u27BF\u2300-\u23FF\u2B50\u2B06\u2192\u26A0\u26A1\uFE0F]+"
)


class ThreadsAccessError(RuntimeError):
    """Raised when public Threads content cannot be accessed anonymously."""


def extract_application_json_blocks(html: str) -> list[Any]:
    """Return valid JSON values embedded in application/json script blocks."""
    payloads: list[Any] = []
    for match in _APPLICATION_JSON_PATTERN.finditer(html or ""):
        raw_json = unescape(match.group(1)).strip()
        if not raw_json:
            continue
        try:
            payloads.append(json.loads(raw_json))
        except json.JSONDecodeError:
            continue
    return payloads


def _iter_thread_item_groups(value: Any) -> Iterator[list[Any]]:
    if isinstance(value, dict):
        thread_items = value.get("thread_items")
        if isinstance(thread_items, list):
            yield thread_items
        for child in value.values():
            yield from _iter_thread_item_groups(child)
    elif isinstance(value, list):
        for child in value:
            yield from _iter_thread_item_groups(child)


def _post_from_item(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    post = item.get("post")
    return post if isinstance(post, dict) else None


def _post_username(post: dict[str, Any]) -> str:
    user = post.get("user")
    username = user.get("username") if isinstance(user, dict) else ""
    return str(username or "").strip().lstrip("@").lower()


def _normalize_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.splitlines()]
    return "\n".join(line for line in lines if line).strip()


def _iter_plaintext(value: Any) -> Iterator[str]:
    if isinstance(value, dict):
        plaintext = value.get("plaintext")
        if isinstance(plaintext, str):
            yield plaintext
        for child in value.values():
            yield from _iter_plaintext(child)
    elif isinstance(value, list):
        for child in value:
            yield from _iter_plaintext(child)


def _snippet_text(post: dict[str, Any]) -> str:
    app_info = post.get("text_post_app_info")
    if not isinstance(app_info, dict):
        return ""
    attachment = app_info.get("snippet_attachment_info")
    if not isinstance(attachment, dict):
        return ""

    parts: list[str] = []
    for plaintext in _iter_plaintext(attachment):
        cleaned = _normalize_text(plaintext)
        if cleaned and cleaned not in parts:
            parts.append(cleaned)
    return "\n".join(parts)


def _post_text(post: dict[str, Any]) -> str:
    caption = post.get("caption")
    caption_text = _normalize_text(caption.get("text") if isinstance(caption, dict) else "")
    snippet_text = _snippet_text(post)
    return snippet_text if len(snippet_text) > len(caption_text) else caption_text


def _taken_at(post: dict[str, Any]) -> int:
    try:
        return int(post.get("taken_at") or 0)
    except (TypeError, ValueError):
        return 0


def _post_summary(post: dict[str, Any]) -> dict[str, Any]:
    caption = post.get("caption")
    caption_text = _normalize_text(caption.get("text") if isinstance(caption, dict) else "")
    return {
        "id": str(post.get("id") or "").strip() or None,
        "code": str(post.get("code") or "").strip(),
        "username": _post_username(post),
        "caption_text": caption_text,
        "snippet_text": _snippet_text(post),
        "text": _post_text(post),
        "taken_at": _taken_at(post),
    }


def extract_profile_thread_summaries(
    payloads: list[Any], *, username: str, limit: int = THREADS_MAX_THREADS
) -> list[dict[str, Any]]:
    """Extract the profile owner's recent root posts from SSR JSON payloads."""
    target_username = username.strip().lstrip("@").lower()
    by_code: dict[str, dict[str, Any]] = {}

    for payload in payloads:
        for thread_items in _iter_thread_item_groups(payload):
            root_post = _post_from_item(thread_items[0]) if thread_items else None
            if not root_post or _post_username(root_post) != target_username:
                continue
            summary = _post_summary(root_post)
            if not summary["code"]:
                continue
            existing = by_code.get(summary["code"])
            if existing is None or summary["taken_at"] > existing["taken_at"]:
                by_code[summary["code"]] = summary

    return sorted(
        by_code.values(), key=lambda post: (post["taken_at"], post["code"]), reverse=True
    )[: max(0, limit)]


def extract_author_thread_posts(
    payloads: list[Any], *, username: str, root_code: str
) -> list[dict[str, Any]]:
    """Extract only the target author's posts that belong to one thread page."""
    target_username = username.strip().lstrip("@").lower()
    posts_by_identity: dict[str, dict[str, Any]] = {}

    for payload in payloads:
        for thread_items in _iter_thread_item_groups(payload):
            raw_posts = [post for item in thread_items if (post := _post_from_item(item))]
            if not any(str(post.get("code") or "").strip() == root_code for post in raw_posts):
                continue
            for post in raw_posts:
                if _post_username(post) != target_username:
                    continue
                summary = _post_summary(post)
                identity = summary["id"] or summary["code"]
                if not identity:
                    continue
                existing = posts_by_identity.get(identity)
                if existing is None or summary["taken_at"] < existing["taken_at"]:
                    posts_by_identity[identity] = summary

    return sorted(posts_by_identity.values(), key=lambda post: (post["taken_at"], post["code"]))


def _canonical_thread_url(post_code: str) -> str:
    return f"https://www.threads.net/t/{quote(post_code, safe='-_')}"


def _article_key(source_url: str) -> str:
    digest = hashlib.sha256(source_url.encode("utf-8")).hexdigest()
    return f"agri_news:{digest}"


def _content_hash(content_text: str | None) -> str | None:
    return hashlib.sha256(content_text.encode("utf-8")).hexdigest() if content_text else None


def taipei_date_from_taken_at(value: Any) -> str | None:
    try:
        timestamp = int(value)
    except (TypeError, ValueError):
        return None
    if timestamp <= 0:
        return None
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).astimezone(_TAIPEI_TZ).date().isoformat()


def _title_from_text(content_text: str) -> str:
    for line in content_text.splitlines():
        cleaned = _LEADING_DECORATION_PATTERN.sub("", line).strip()
        cleaned = re.sub(r"\s+", " ", cleaned)
        if cleaned:
            return cleaned[:200]
    return "農民日常 Threads 貼文"


def thread_article_from_posts(
    root_post: dict[str, Any],
    author_posts: list[dict[str, Any]],
    *,
    detail_error: str | None = None,
    detail_parsed: bool = True,
) -> dict[str, Any]:
    """Convert one root post and its author-only thread posts to news format."""
    root_code = str(root_post.get("code") or "").strip()
    root_text = _normalize_text(root_post.get("text") or root_post.get("caption_text") or "")
    ordered_posts = sorted(author_posts, key=lambda post: (post.get("taken_at", 0), post.get("code", "")))
    segments: list[str] = []
    seen_segments: set[str] = set()
    if not any(post.get("code") == root_code for post in ordered_posts) and root_text:
        segments.append(root_text)
        seen_segments.add(root_text)
    for post in ordered_posts:
        text = _normalize_text(post.get("text") or post.get("caption_text") or "")
        if text and text not in seen_segments:
            segments.append(text)
            seen_segments.add(text)

    content_text = "\n\n".join(segments) or None
    if content_text:
        parse_status = "success" if detail_parsed and not detail_error else "partial"
        parse_error = detail_error
    elif detail_parsed:
        parse_status = "failed"
        parse_error = detail_error or "Threads detail page contained no author post text"
    else:
        parse_status = "partial"
        parse_error = detail_error or "Threads detail page could not be parsed"

    source_url = _canonical_thread_url(root_code)
    return {
        "article_key": _article_key(source_url),
        "source_name": THREADS_SOURCE_NAME,
        "source_article_id": root_code,
        "title": _title_from_text(root_text or content_text or ""),
        "published_date": taipei_date_from_taken_at(root_post.get("taken_at")),
        "source_url": source_url,
        "content_text": content_text,
        "content_hash": _content_hash(content_text),
        "parse_status": parse_status,
        "parse_error": parse_error,
        "crawl_source": "threads",
    }


def _sync_playwright():
    from playwright.sync_api import sync_playwright

    return sync_playwright


def _profile_url(username: str) -> str:
    if username == "abc89151207":
        return THREADS_PROFILE_URL
    return f"https://www.threads.net/@{quote(username, safe='-_')}?hl=zh-tw"


def _assert_public_threads_page(page: Any, *, expected: str) -> None:
    parsed = urlparse(page.url)
    if parsed.netloc.lower() not in {"threads.net", "www.threads.net", "threads.com", "www.threads.com"}:
        raise ThreadsAccessError(f"Threads redirected to an unexpected host while loading {expected}")
    if "/login" in parsed.path.lower() or "/accounts/login" in parsed.path.lower():
        raise ThreadsAccessError(f"Threads requires login to access {expected}")
    title = (page.title() or "").lower()
    if "page not found" in title or "無法預覽" in title or "not available" in title:
        raise ThreadsAccessError(f"Threads page is private, missing, or inaccessible: {expected}")


def _load_page_html(page: Any, url: str, *, delay_seconds: float) -> str:
    response = page.goto(url, wait_until="domcontentloaded", timeout=THREADS_PAGE_TIMEOUT_MS)
    if response is not None and response.status == 404:
        raise ThreadsAccessError(f"Threads page was not found: {url}")
    _assert_public_threads_page(page, expected=url)
    if delay_seconds:
        page.wait_for_timeout(int(delay_seconds * 1000))
    return page.content()


def fetch_threads_posts(
    limit: int = THREADS_MAX_THREADS, *, username: str = THREADS_USERNAME
) -> list[dict[str, Any]]:
    """Fetch public Threads discussions without authentication."""
    username = username.strip().lstrip("@")
    if not username:
        raise ValueError("Threads username must not be blank")

    browser = None
    try:
        with _sync_playwright()() as playwright:
            browser = playwright.chromium.launch(
                headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"]
            )
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 800},
            )
            page = context.new_page()
            page.set_default_timeout(THREADS_PAGE_TIMEOUT_MS)
            profile_html = _load_page_html(
                page, _profile_url(username), delay_seconds=THREADS_DETAIL_DELAY_SECONDS
            )
            roots = extract_profile_thread_summaries(
                extract_application_json_blocks(profile_html),
                username=username,
                limit=min(max(0, limit), THREADS_MAX_THREADS),
            )

            articles: list[dict[str, Any]] = []
            for root in roots:
                detail_url = f"{_canonical_thread_url(root['code'])}?hl=zh-tw"
                try:
                    detail_html = _load_page_html(
                        page, detail_url, delay_seconds=THREADS_DETAIL_DELAY_SECONDS
                    )
                    author_posts = extract_author_thread_posts(
                        extract_application_json_blocks(detail_html),
                        username=username,
                        root_code=root["code"],
                    )
                    articles.append(thread_article_from_posts(root, author_posts))
                except Exception as exc:
                    articles.append(
                        thread_article_from_posts(
                            root, [], detail_error=str(exc), detail_parsed=False
                        )
                    )
            return articles
    except Exception as exc:
        _LOGGER.warning("Threads profile crawl unavailable for @%s: %s", username, exc)
        return []
    finally:
        if browser is not None:
            try:
                browser.close()
            except Exception:
                pass
