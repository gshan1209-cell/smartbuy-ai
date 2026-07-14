"""
Fetch Ministry of Agriculture and Agriculture and Food Agency news articles.

Crawler concepts are based on the public mdbenshow-art/NEWS project, then
rewritten for SmartBuy AI with article-detail parsing and normalized records.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any
from urllib.parse import parse_qs, parse_qsl, urlencode, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup


MOA_LIST_URL = "https://www.moa.gov.tw/theme_list.php?theme=news&sub_theme=agri"
AFA_LIST_URL = "https://www.afa.gov.tw/cht/index.php?code=list&ids=307"
MOA_BASE_URL = "https://www.moa.gov.tw/"
AFA_BASE_URL = "https://www.afa.gov.tw/cht/"

REQUEST_TIMEOUT = (10, 30)
USER_AGENT = "SmartBuy-AI-MVP/0.1 (+https://github.com/gshan1209-cell/smartbuy-ai)"


def _normalize_source_url(url: str) -> str:
    parsed = urlparse(url.strip())
    query = urlencode(sorted(parse_qsl(parsed.query, keep_blank_values=True)))
    path = parsed.path or "/"
    if path != "/":
        path = path.rstrip("/")
    normalized = parsed._replace(
        scheme=parsed.scheme.lower(),
        netloc=parsed.netloc.lower(),
        path=path,
        query=query,
        fragment="",
    )
    return urlunparse(normalized)


def _article_key(url: str) -> str:
    normalized_url = _normalize_source_url(url)
    digest = hashlib.sha256(normalized_url.encode("utf-8")).hexdigest()
    return f"agri_news:{digest}"


def _content_hash(content_text: str | None) -> str | None:
    if not content_text:
        return None
    return hashlib.sha256(content_text.encode("utf-8")).hexdigest()


def _roc_date_to_iso(value: Any) -> str | None:
    if value is None:
        return None

    text = str(value).strip()
    match = re.search(r"(\d{2,4})[./-](\d{1,2})[./-](\d{1,2})", text)
    if not match:
        return None

    year = int(match.group(1))
    month = int(match.group(2))
    day = int(match.group(3))

    if year < 1911:
        year += 1911

    try:
        return f"{year:04d}-{month:02d}-{day:02d}"
    except ValueError:
        return None


def _source_article_id_from_url(url: str, key: str) -> str | None:
    value = parse_qs(urlparse(url).query).get(key, [None])[0]
    return str(value).strip() if value else None


def _empty_article(
    *,
    source_name: str,
    source_url: str,
    title: str = "",
    source_article_id: str | None = None,
    published_date: str | None = None,
    parse_status: str = "partial",
    parse_error: str | None = None,
) -> dict[str, Any]:
    normalized_url = _normalize_source_url(source_url)
    return {
        "article_key": _article_key(normalized_url),
        "source_name": source_name,
        "source_article_id": source_article_id,
        "title": title,
        "published_date": published_date,
        "source_url": normalized_url,
        "content_text": None,
        "content_hash": None,
        "parse_status": parse_status,
        "parse_error": parse_error,
    }


def _get_html(url: str) -> str:
    response = requests.get(
        url,
        headers={"User-Agent": USER_AGENT},
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    if response.apparent_encoding:
        response.encoding = response.apparent_encoding
    return response.text


def _clean_text(node: Any) -> str | None:
    for unwanted in node.select(
        "script, style, noscript, nav, header, footer, .breadcrumb, .share, "
        ".social, .tool, .function, .accesskey, .pagination"
    ):
        unwanted.decompose()

    lines: list[str] = []
    for raw_line in node.get_text("\n", strip=True).splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if line:
            lines.append(line)

    text = "\n".join(lines).strip()
    return text or None


def _article_from_content(
    *,
    source_name: str,
    source_url: str,
    source_article_id: str | None,
    title: str,
    published_date: str | None,
    content_text: str | None,
) -> dict[str, Any]:
    article = _empty_article(
        source_name=source_name,
        source_url=source_url,
        source_article_id=source_article_id,
        title=title,
        published_date=published_date,
        parse_status="success" if content_text else "partial",
        parse_error=None if content_text else "article content selector returned no text",
    )
    article["content_text"] = content_text
    article["content_hash"] = _content_hash(content_text)
    return article


def fetch_moa_news_list(limit: int = 10) -> list[dict[str, Any]]:
    try:
        html = _get_html(MOA_LIST_URL)
    except Exception:
        return []

    soup = BeautifulSoup(html, "html.parser")
    rows = soup.select("div.no-more-tables tbody tr")
    news_items: list[dict[str, Any]] = []

    for row in rows:
        if len(news_items) >= limit:
            break

        cells = row.find_all("td")
        if len(cells) < 3:
            continue

        link = cells[2].find("a", href=True)
        if not link:
            continue

        source_url = urljoin(MOA_BASE_URL, link["href"].strip())
        title = (link.get("title") or link.get_text(" ", strip=True)).strip()
        source_article_id = cells[0].get_text(" ", strip=True) or _source_article_id_from_url(
            source_url, "id"
        )

        if title and source_url:
            news_items.append(
                _empty_article(
                    source_name="農業部",
                    source_article_id=source_article_id,
                    title=title,
                    published_date=_roc_date_to_iso(cells[1].get_text(" ", strip=True)),
                    source_url=source_url,
                    parse_status="partial",
                )
            )

    return news_items


def fetch_afa_news_list(limit: int = 10) -> list[dict[str, Any]]:
    news_items: list[dict[str, Any]] = []
    page = 1

    while len(news_items) < limit:
        url = AFA_LIST_URL if page == 1 else f"{AFA_LIST_URL}&page={page}"
        try:
            html = _get_html(url)
        except Exception:
            break

        soup = BeautifulSoup(html, "html.parser")
        items = soup.select("a.agricultural-news")
        if not items:
            break

        page_added = 0
        for item in items:
            if len(news_items) >= limit:
                break

            href = item.get("href", "").strip()
            source_url = urljoin(AFA_BASE_URL, href)
            title = (item.get("title") or "").strip()
            if not title:
                heading = item.find(["h2", "h3", "h4"])
                title = heading.get_text(" ", strip=True) if heading else ""

            ribbon = item.select_one(".agricultural-news-ribbon span")
            published_date = _roc_date_to_iso(
                ribbon.get_text(" ", strip=True) if ribbon else item.get_text(" ", strip=True)
            )
            source_article_id = _source_article_id_from_url(source_url, "article_id")

            if title and source_url:
                news_items.append(
                    _empty_article(
                        source_name="農糧署",
                        source_article_id=source_article_id,
                        title=title,
                        published_date=published_date,
                        source_url=source_url,
                        parse_status="partial",
                    )
                )
                page_added += 1

        if page_added == 0:
            break
        page += 1

    return news_items


def fetch_moa_article_content(url: str) -> dict[str, Any]:
    try:
        html = _get_html(url)
        soup = BeautifulSoup(html, "html.parser")
        content_node = soup.select_one("div.edit.lh-lg") or soup.select_one("div.edit")
        if not content_node:
            raise ValueError("MOA article content selector not found: div.edit.lh-lg")

        title_node = soup.select_one("#content h2") or soup.find("h2")
        title = title_node.get_text(" ", strip=True) if title_node else ""
        page_text = soup.select_one("#content")
        published_date = _roc_date_to_iso(page_text.get_text(" ", strip=True) if page_text else "")
        content_text = _clean_text(content_node)

        return _article_from_content(
            source_name="農業部",
            source_url=url,
            source_article_id=_source_article_id_from_url(url, "id"),
            title=title,
            published_date=published_date,
            content_text=content_text,
        )
    except Exception as exc:
        return _empty_article(
            source_name="農業部",
            source_url=url,
            source_article_id=_source_article_id_from_url(url, "id"),
            parse_status="failed",
            parse_error=str(exc),
        )


def fetch_afa_article_content(url: str) -> dict[str, Any]:
    try:
        html = _get_html(url)
        soup = BeautifulSoup(html, "html.parser")
        content_node = soup.select_one("article.shared-content-text")
        if not content_node:
            raise ValueError(
                "AFA article content selector not found: article.shared-content-text"
            )

        title_node = soup.select_one("#content h3") or soup.find("h3")
        title = title_node.get_text(" ", strip=True) if title_node else ""
        page_text = soup.select_one("#content")
        published_date = _roc_date_to_iso(page_text.get_text(" ", strip=True) if page_text else "")
        content_text = _clean_text(content_node)

        return _article_from_content(
            source_name="農糧署",
            source_url=url,
            source_article_id=_source_article_id_from_url(url, "article_id"),
            title=title,
            published_date=published_date,
            content_text=content_text,
        )
    except Exception as exc:
        return _empty_article(
            source_name="農糧署",
            source_url=url,
            source_article_id=_source_article_id_from_url(url, "article_id"),
            parse_status="failed",
            parse_error=str(exc),
        )


def _merge_article(base: dict[str, Any], detail: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key in ["content_text", "content_hash", "parse_status", "parse_error"]:
        merged[key] = detail.get(key)

    for key in ["source_article_id", "title", "published_date"]:
        if not merged.get(key) and detail.get(key):
            merged[key] = detail[key]

    merged["source_url"] = _normalize_source_url(merged["source_url"])
    merged["article_key"] = _article_key(merged["source_url"])
    return merged


def fetch_agri_news(limit_per_source: int = 10) -> list[dict[str, Any]]:
    moa_items = fetch_moa_news_list(limit_per_source)
    afa_items = fetch_afa_news_list(limit_per_source)

    if not moa_items and not afa_items:
        raise RuntimeError("Unable to fetch any agriculture news list data.")

    articles: list[dict[str, Any]] = []
    for item in moa_items:
        detail = fetch_moa_article_content(item["source_url"])
        articles.append(_merge_article(item, detail))

    for item in afa_items:
        detail = fetch_afa_article_content(item["source_url"])
        articles.append(_merge_article(item, detail))

    return articles
