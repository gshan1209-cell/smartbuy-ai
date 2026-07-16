"""
Fetch agriculture news articles from government, PTT, Agriharvest, and Yahoo.

Crawler concepts for the extra sources were reviewed from the public
mdbenshow-art/NEWS project, then rewritten for SmartBuy AI with detail-page
parsing, normalized records, and database-ready article bodies.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
import re
import time
from typing import Any
from urllib.parse import parse_qs, parse_qsl, quote, urlencode, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup


MOA_LIST_URL = "https://www.moa.gov.tw/theme_list.php?theme=news&sub_theme=agri"
AFA_LIST_URL = "https://www.afa.gov.tw/cht/index.php?code=list&ids=307"
PTT_FRUITS_LIST_URL = "https://www.ptt.cc/bbs/Fruits/index.html"
AGRIHARVEST_LIST_URL = "https://www.agriharvest.tw/archives/category/%E6%96%B0%E8%81%9E/"
YAHOO_SEARCH_URL = "https://tw.news.yahoo.com/search"
MOA_BASE_URL = "https://www.moa.gov.tw/"
AFA_BASE_URL = "https://www.afa.gov.tw/cht/"
PTT_BASE_URL = "https://www.ptt.cc"
AGRIHARVEST_BASE_URL = "https://www.agriharvest.tw/"
YAHOO_BASE_URL = "https://tw.news.yahoo.com/"

REQUEST_TIMEOUT = (10, 30)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
YAHOO_SEARCH_DELAY_SECONDS = 0.25
YAHOO_CANDIDATE_LIMIT = 60
YAHOO_FINAL_LIMIT = 10
TAIPEI_TZ = timezone(timedelta(hours=8))

STRONG_AGRI_CONTEXT_TERMS = {
    "農業",
    "農民",
    "農產",
    "農產品",
    "產地",
    "產量",
    "採收",
    "栽培",
    "種植",
    "農場",
    "農園",
    "農地",
    "作物",
    "農糧署",
    "農業部",
    "農會",
    "產銷",
    "災損",
    "農損",
    "病蟲害",
    "農藥",
    "批發市場",
    "拍賣市場",
}
MARKET_CONTEXT_TERMS = {
    "菜價",
    "果價",
    "價格",
    "供應",
    "供需",
    "收購",
    "庫存",
    "進口",
    "出口",
    "批發",
    "拍賣",
    "市場交易",
    "盛產",
    "歉收",
    "減產",
    "漲價",
    "跌價",
}


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
        datetime(year, month, day)
        return f"{year:04d}-{month:02d}-{day:02d}"
    except ValueError:
        return None


def _compact_date_to_iso(value: Any) -> str | None:
    text = str(value or "").strip()
    match = re.search(r"(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)", text)
    if not match:
        return _roc_date_to_iso(text)

    year = int(match.group(1))
    month = int(match.group(2))
    day = int(match.group(3))
    try:
        datetime(year, month, day)
        return f"{year:04d}-{month:02d}-{day:02d}"
    except ValueError:
        return None


def _ptt_date_to_iso(value: Any) -> str | None:
    text = re.sub(r"\s+", " ", str(value or "").strip())
    if not text:
        return None

    for fmt in ("%a %b %d %H:%M:%S %Y", "%a %b %e %H:%M:%S %Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _yahoo_date_to_iso(value: Any) -> str | None:
    text = str(value or "").strip()
    now = datetime.now(TAIPEI_TZ)

    if not text:
        return None

    relative_patterns = [
        (r"(\d+)\s*分鐘前", "minutes"),
        (r"(\d+)\s*小時前", "hours"),
        (r"(\d+)\s*天前", "days"),
    ]
    for pattern, unit in relative_patterns:
        match = re.search(pattern, text)
        if match:
            delta = timedelta(**{unit: int(match.group(1))})
            return (now - delta).date().isoformat()

    if "剛剛" in text or "秒前" in text:
        return now.date().isoformat()
    if "昨天" in text or "昨日" in text:
        return (now - timedelta(days=1)).date().isoformat()

    match = re.search(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日", text)
    if match:
        return _roc_date_to_iso("-".join(match.groups()))

    match = re.search(r"(\d{1,2})\s*月\s*(\d{1,2})\s*日", text)
    if match:
        month = int(match.group(1))
        day = int(match.group(2))
        try:
            return datetime(now.year, month, day).date().isoformat()
        except ValueError:
            return None

    return _roc_date_to_iso(text)


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
    crawl_source: str | None = None,
    matched_crop_names: list[str] | None = None,
    rejection_reason: str | None = None,
) -> dict[str, Any]:
    normalized_url = _normalize_source_url(source_url)
    article = {
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
    if crawl_source:
        article["crawl_source"] = crawl_source
    if matched_crop_names is not None:
        article["matched_crop_names"] = list(dict.fromkeys(matched_crop_names))
    if rejection_reason:
        article["rejection_reason"] = rejection_reason
    return article


def _get_html(url: str, headers: dict[str, str] | None = None) -> str:
    request_headers = {"User-Agent": USER_AGENT}
    if headers:
        request_headers.update(headers)
    response = requests.get(
        url,
        headers=request_headers,
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    if response.apparent_encoding:
        response.encoding = response.apparent_encoding
    return response.text


def _clean_text(node: Any) -> str | None:
    for unwanted in node.select(
        "script, style, noscript, nav, header, footer, .breadcrumb, .share, "
        ".social, .tool, .function, .accesskey, .pagination, .author, .tags, "
        ".tag, .related, .recommend, .advertisement, .ads, .ad, .entry-footer, "
        ".post-navigation, .sharedaddy, .addtoany_share_save_container, "
        ".caas-share-buttons, .caas-readmore, .caas-figure, .caas-attr, "
        ".caas-tags, .caas-related"
    ):
        unwanted.decompose()

    lines: list[str] = []
    for raw_line in node.get_text("\n", strip=True).splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if re.search(r"^(延伸閱讀|相關文章|更多新聞|看更多|廣告|分享)$", line):
            continue
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
    crawl_source: str | None = None,
) -> dict[str, Any]:
    article = _empty_article(
        source_name=source_name,
        source_url=source_url,
        source_article_id=source_article_id,
        title=title,
        published_date=published_date,
        parse_status="success" if content_text else "partial",
        parse_error=None if content_text else "article content selector returned no text",
        crawl_source=crawl_source,
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
                    crawl_source="moa",
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
                        crawl_source="afa",
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
            crawl_source="moa",
        )
    except Exception as exc:
        return _empty_article(
            source_name="農業部",
            source_url=url,
            source_article_id=_source_article_id_from_url(url, "id"),
            parse_status="failed",
            parse_error=str(exc),
            crawl_source="moa",
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
            crawl_source="afa",
        )
    except Exception as exc:
        return _empty_article(
            source_name="農糧署",
            source_url=url,
            source_article_id=_source_article_id_from_url(url, "article_id"),
            parse_status="failed",
            parse_error=str(exc),
            crawl_source="afa",
        )


def _ptt_article_id_from_url(url: str) -> str | None:
    match = re.search(r"/bbs/Fruits/(M\.\d+\.A\.[A-Za-z0-9]+)\.html", url)
    return match.group(1) if match else None


def fetch_ptt_fruits_news_list(limit: int = 10) -> list[dict[str, Any]]:
    try:
        html = _get_html(PTT_FRUITS_LIST_URL, headers={"Cookie": "over18=1"})
    except Exception:
        return []

    soup = BeautifulSoup(html, "html.parser")
    separator = soup.find("div", class_="r-list-sep")
    rows = (
        separator.find_previous_siblings("div", class_="r-ent")
        if separator
        else list(reversed(soup.select("div.r-ent")))
    )

    news_items: list[dict[str, Any]] = []
    for row in rows:
        if len(news_items) >= limit:
            break

        title_node = row.select_one("div.title a[href]")
        if not title_node:
            continue

        title = title_node.get_text(" ", strip=True)
        source_url = urljoin(PTT_BASE_URL, title_node["href"].strip())
        if title and source_url:
            news_items.append(
                _empty_article(
                    source_name="PTT Fruits",
                    source_article_id=_ptt_article_id_from_url(source_url),
                    title=title,
                    published_date=None,
                    source_url=source_url,
                    parse_status="partial",
                    crawl_source="ptt_fruits",
                )
            )

    return news_items


def _clean_ptt_content(soup: BeautifulSoup) -> str | None:
    main = soup.select_one("#main-content")
    if not main:
        return None

    for unwanted in main.select(
        ".article-metaline, .article-metaline-right, .push, .f2, script, style"
    ):
        unwanted.decompose()

    lines: list[str] = []
    in_signature = False
    for raw_line in main.get_text("\n", strip=False).splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line == "--":
            in_signature = True
            continue
        if in_signature:
            continue
        if line.startswith(("作者", "看板", "標題", "時間")):
            continue
        if line.startswith("※"):
            continue
        if re.search(r"\b\d{1,3}(?:\.\d{1,3}){3}\b", line):
            continue
        lines.append(re.sub(r"\s+", " ", line))

    text = "\n".join(lines).strip()
    return text or None


def fetch_ptt_fruits_article_content(url: str) -> dict[str, Any]:
    try:
        html = _get_html(url, headers={"Cookie": "over18=1"})
        soup = BeautifulSoup(html, "html.parser")
        meta: dict[str, str] = {}
        for line in soup.select("div.article-metaline"):
            tag = line.select_one(".article-meta-tag")
            value = line.select_one(".article-meta-value")
            if tag and value:
                meta[tag.get_text(" ", strip=True)] = value.get_text(" ", strip=True)

        title = meta.get("標題", "")
        published_date = _ptt_date_to_iso(meta.get("時間"))
        content_text = _clean_ptt_content(soup)
        if not content_text:
            raise ValueError("PTT article body is empty after metadata and push cleanup")

        return _article_from_content(
            source_name="PTT Fruits",
            source_url=url,
            source_article_id=_ptt_article_id_from_url(url),
            title=title,
            published_date=published_date,
            content_text=content_text,
            crawl_source="ptt_fruits",
        )
    except Exception as exc:
        return _empty_article(
            source_name="PTT Fruits",
            source_url=url,
            source_article_id=_ptt_article_id_from_url(url),
            parse_status="failed",
            parse_error=str(exc),
            crawl_source="ptt_fruits",
        )


def _agriharvest_article_id_from_url(url: str) -> str | None:
    match = re.search(r"/archives/(\d+)", url)
    return match.group(1) if match else None


def fetch_agriharvest_news_list(limit: int = 10) -> list[dict[str, Any]]:
    try:
        html = _get_html(AGRIHARVEST_LIST_URL)
    except Exception:
        return []

    soup = BeautifulSoup(html, "html.parser")
    links = soup.select("a.post-title[href], h2.entry-title a[href], h3.entry-title a[href]")
    news_items: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for link in links:
        if len(news_items) >= limit:
            break

        title = link.get_text(" ", strip=True)
        source_url = _normalize_source_url(urljoin(AGRIHARVEST_BASE_URL, link["href"].strip()))
        if not title or source_url in seen_urls:
            continue

        container = link.find_parent(["article", "div", "li"]) or link.parent
        date_text = ""
        if container:
            date_node = container.select_one("li.post-date, time, .post-date, .date")
            if date_node:
                date_text = date_node.get("datetime") or date_node.get_text(" ", strip=True)

        seen_urls.add(source_url)
        news_items.append(
            _empty_article(
                source_name="農傳媒",
                source_article_id=_agriharvest_article_id_from_url(source_url),
                title=title,
                published_date=_compact_date_to_iso(date_text),
                source_url=source_url,
                parse_status="partial",
                crawl_source="agriharvest",
            )
        )

    return news_items


def fetch_agriharvest_article_content(url: str) -> dict[str, Any]:
    try:
        html = _get_html(url)
        soup = BeautifulSoup(html, "html.parser")
        content_node = (
            soup.select_one("div.entry-content")
            or soup.select_one(".article-content")
            or soup.select_one("article .post-content")
            or soup.select_one("article .content")
            or soup.select_one("article")
        )
        if not content_node:
            raise ValueError("Agriharvest article content selector not found: div.entry-content")

        title_node = soup.select_one("h1.entry-title") or soup.find("h1")
        title = title_node.get_text(" ", strip=True) if title_node else ""
        date_node = (
            soup.select_one("time[datetime]")
            or soup.select_one("meta[property='article:published_time']")
            or soup.select_one(".post-date")
        )
        date_text = ""
        if date_node:
            date_text = date_node.get("datetime") or date_node.get("content") or date_node.get_text(" ", strip=True)
        content_text = _clean_text(content_node)

        return _article_from_content(
            source_name="農傳媒",
            source_url=url,
            source_article_id=_agriharvest_article_id_from_url(url),
            title=title,
            published_date=_compact_date_to_iso(date_text),
            content_text=content_text,
            crawl_source="agriharvest",
        )
    except Exception as exc:
        return _empty_article(
            source_name="農傳媒",
            source_url=url,
            source_article_id=_agriharvest_article_id_from_url(url),
            parse_status="failed",
            parse_error=str(exc),
            crawl_source="agriharvest",
        )


def build_yahoo_search_url(keyword: str) -> str:
    return f"{YAHOO_SEARCH_URL}?p={quote(keyword.strip(), safe='')}"


def _yahoo_article_id_from_url(url: str) -> str | None:
    match = re.search(r"-(\d+)\.html(?:$|\?)", url)
    return match.group(1) if match else None


def _yahoo_publisher_from_meta(card: Any) -> tuple[str | None, str | None]:
    meta_node = card.select_one(".text-px12") or card.select_one("[class*='text-px12']")
    if not meta_node:
        return None, None

    meta_text = re.sub(r"\s+", " ", meta_node.get_text(" ", strip=True)).strip()
    if not meta_text:
        return None, None

    parts = [part.strip() for part in re.split(r"[・|]", meta_text) if part.strip()]
    if len(parts) >= 2:
        return parts[0], parts[1]
    return None, parts[0]


def _split_yahoo_title_and_source(raw_title: str, publisher: str | None) -> tuple[str, str]:
    title = re.sub(r"\s+", " ", raw_title).strip()
    prefix_match = re.match(r"^\[([^\]]+)\]\s*(.+)$", title)
    prefix_source = None
    if prefix_match:
        prefix_source = prefix_match.group(1).strip()
        title = prefix_match.group(2).strip()

    source_name = (publisher or prefix_source or "Yahoo新聞").strip()
    return title, source_name or "Yahoo新聞"


def _published_sort_key(article: dict[str, Any]) -> tuple[str, str]:
    return (article.get("published_date") or "", article.get("title") or "")


def _add_matched_crop_name(article: dict[str, Any], crop_name: str) -> None:
    matched = article.setdefault("matched_crop_names", [])
    if crop_name not in matched:
        matched.append(crop_name)


def _yahoo_card_mentions_crop(*, title: str, card_text: str, crop_name: str) -> bool:
    return crop_name in title or crop_name in card_text


def evaluate_yahoo_relevance(
    *,
    title: str,
    content_text: str | None,
    matched_crop_names: list[str],
) -> tuple[bool, str]:
    normalized_crops = [
        crop for crop in dict.fromkeys(str(crop).strip() for crop in matched_crop_names) if crop
    ]
    if not normalized_crops:
        return False, "no matched crop names"

    body = content_text or ""
    combined_text = f"{title}\n{body}"
    strong_terms = sorted(term for term in STRONG_AGRI_CONTEXT_TERMS if term in combined_text)
    market_terms = sorted(term for term in MARKET_CONTEXT_TERMS if term in combined_text)
    strong_context_found = bool(strong_terms)
    market_context_count = len(set(market_terms))

    for crop_name in normalized_crops:
        if len(crop_name) == 1:
            crop_match = crop_name in title or body.count(crop_name) >= 3
            if crop_match and strong_context_found:
                return True, (
                    f"single-character crop '{crop_name}' matched with strong agriculture "
                    f"context: {', '.join(strong_terms[:3])}"
                )
            continue

        crop_match = crop_name in title or body.count(crop_name) >= 2
        context_match = strong_context_found or market_context_count >= 2
        if crop_match and context_match:
            context_reason = (
                f"strong agriculture context: {', '.join(strong_terms[:3])}"
                if strong_context_found
                else f"market context terms: {', '.join(market_terms[:3])}"
            )
            return True, f"crop '{crop_name}' matched with {context_reason}"

    return (
        False,
        "missing required crop frequency or agriculture/market context",
    )


def fetch_yahoo_news_list(
    keywords: list[str] | None,
    *,
    limit: int = YAHOO_CANDIDATE_LIMIT,
) -> list[dict[str, Any]]:
    normalized_keywords = []
    seen_keywords: set[str] = set()
    for keyword in keywords or []:
        normalized = str(keyword).strip()
        if normalized and normalized not in seen_keywords:
            normalized_keywords.append(normalized)
            seen_keywords.add(normalized)

    deduped: dict[str, dict[str, Any]] = {}
    for index, keyword in enumerate(normalized_keywords):
        if index > 0 and YAHOO_SEARCH_DELAY_SECONDS > 0:
            time.sleep(YAHOO_SEARCH_DELAY_SECONDS)

        try:
            html = _get_html(build_yahoo_search_url(keyword))
        except Exception:
            continue

        soup = BeautifulSoup(html, "html.parser")
        cards = soup.select("li.stream-card")
        for card in cards:
            link = card.select_one("h3 a[href]") or card.select_one("a[href]")
            if not link:
                continue

            raw_title = link.get_text(" ", strip=True)
            href = link.get("href", "").strip()
            if not raw_title or not href:
                continue

            card_text = re.sub(r"\s+", " ", card.get_text(" ", strip=True)).strip()
            if not _yahoo_card_mentions_crop(
                title=raw_title,
                card_text=card_text,
                crop_name=keyword,
            ):
                continue

            source_url = _normalize_source_url(urljoin(YAHOO_BASE_URL, href))
            if source_url in deduped:
                _add_matched_crop_name(deduped[source_url], keyword)
                continue

            publisher, date_text = _yahoo_publisher_from_meta(card)
            title, source_name = _split_yahoo_title_and_source(raw_title, publisher)
            deduped[source_url] = _empty_article(
                source_name=source_name,
                source_article_id=_yahoo_article_id_from_url(source_url),
                title=title,
                published_date=_yahoo_date_to_iso(date_text),
                source_url=source_url,
                parse_status="partial",
                crawl_source="yahoo",
                matched_crop_names=[keyword],
            )

    articles = sorted(deduped.values(), key=_published_sort_key, reverse=True)
    return articles[: min(limit, YAHOO_CANDIDATE_LIMIT)]


def fetch_yahoo_article_content(url: str) -> dict[str, Any]:
    try:
        html = _get_html(url)
        soup = BeautifulSoup(html, "html.parser")
        content_node = (
            soup.select_one("div.caas-body")
            or soup.select_one("article div[class*='body']")
            or soup.select_one("article")
        )
        if not content_node:
            raise ValueError("Yahoo article content selector not found: div.caas-body")

        title_node = soup.select_one("h1") or soup.select_one("header h1")
        title = title_node.get_text(" ", strip=True) if title_node else ""
        date_node = soup.select_one("time[datetime]") or soup.select_one("meta[property='article:published_time']")
        date_text = ""
        if date_node:
            date_text = date_node.get("datetime") or date_node.get("content") or date_node.get_text(" ", strip=True)
        content_text = _clean_text(content_node)

        return _article_from_content(
            source_name="Yahoo新聞",
            source_url=url,
            source_article_id=_yahoo_article_id_from_url(url),
            title=title,
            published_date=_yahoo_date_to_iso(date_text) or _compact_date_to_iso(date_text),
            content_text=content_text,
            crawl_source="yahoo",
        )
    except Exception as exc:
        return _empty_article(
            source_name="Yahoo新聞",
            source_url=url,
            source_article_id=_yahoo_article_id_from_url(url),
            parse_status="failed",
            parse_error=str(exc),
            crawl_source="yahoo",
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
    if base.get("crawl_source") or detail.get("crawl_source"):
        merged["crawl_source"] = base.get("crawl_source") or detail.get("crawl_source")
    if base.get("matched_crop_names") or detail.get("matched_crop_names"):
        merged["matched_crop_names"] = list(
            dict.fromkeys(
                [
                    *base.get("matched_crop_names", []),
                    *detail.get("matched_crop_names", []),
                ]
            )
        )
    return merged


def fetch_relevant_yahoo_articles(
    yahoo_keywords: list[str] | None,
    *,
    candidate_limit: int = YAHOO_CANDIDATE_LIMIT,
    final_limit: int = YAHOO_FINAL_LIMIT,
) -> list[dict[str, Any]]:
    candidates = fetch_yahoo_news_list(yahoo_keywords, limit=candidate_limit)
    accepted: list[dict[str, Any]] = []

    for candidate in candidates:
        detail = fetch_yahoo_article_content(candidate["source_url"])
        article = _merge_article(candidate, detail)
        is_relevant, reason = evaluate_yahoo_relevance(
            title=article.get("title") or "",
            content_text=article.get("content_text"),
            matched_crop_names=article.get("matched_crop_names", []),
        )
        if not is_relevant:
            article["rejection_reason"] = reason
            continue
        article["relevance_reason"] = reason
        accepted.append(article)

    accepted.sort(key=_published_sort_key, reverse=True)
    return accepted[: min(final_limit, YAHOO_FINAL_LIMIT)]


def fetch_agri_news(
    limit_per_source: int = 10,
    yahoo_keywords: list[str] | None = None,
) -> list[dict[str, Any]]:
    source_jobs = [
        (fetch_moa_news_list(limit_per_source), fetch_moa_article_content),
        (fetch_afa_news_list(limit_per_source), fetch_afa_article_content),
        (fetch_ptt_fruits_news_list(limit_per_source), fetch_ptt_fruits_article_content),
        (fetch_agriharvest_news_list(limit_per_source), fetch_agriharvest_article_content),
    ]
    yahoo_articles = fetch_relevant_yahoo_articles(
        yahoo_keywords,
        candidate_limit=YAHOO_CANDIDATE_LIMIT,
        final_limit=min(limit_per_source, YAHOO_FINAL_LIMIT),
    )

    if not any(items for items, _detail_fetcher in source_jobs) and not yahoo_articles:
        raise RuntimeError("Unable to fetch any agriculture news list data.")

    articles: list[dict[str, Any]] = []
    for items, detail_fetcher in source_jobs:
        for item in items:
            detail = detail_fetcher(item["source_url"])
            articles.append(_merge_article(item, detail))

    articles.extend(yahoo_articles)
    return articles
