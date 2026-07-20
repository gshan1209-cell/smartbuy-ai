"""
Fetch agriculture news articles from government, PTT, Agriharvest, and Yahoo.

Crawler concepts for the extra sources were reviewed from the public
mdbenshow-art/NEWS project, then rewritten for SmartBuy AI with detail-page
parsing, normalized records, and database-ready article bodies.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
import hashlib
from datetime import datetime, timedelta, timezone
import re
import time
from typing import Any
from urllib.parse import parse_qs, parse_qsl, quote, urlencode, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from src.data.fetch_threads_posts import fetch_threads_posts


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
AGRI_CONTEXT_WINDOW_CHARS = 50
SINGLE_CROP_CONTEXT_WINDOW_CHARS = 12
YAHOO_RELEVANCE_SCORE_THRESHOLD = 7
YAHOO_EXCLUDED_CROP_NAMES = {"其他", "休市"}

AGRI_PRODUCTION_CONTEXT_TERMS = {
    "農業",
    "農民",
    "農戶",
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
    "果園",
    "田間",
    "溫室",
    "型農",
    "農機",
    "智慧農業",
    "智慧農場",
    "灌溉",
    "果農",
    "菜農",
    "寒害",
    "作物",
    "農損",
    "災損",
    "病蟲害",
    "農藥",
    "農會",
    "產銷班",
    "農糧署",
    "農業部",
}
AGRI_MARKET_CONTEXT_TERMS = {
    "菜價",
    "果價",
    "產地價",
    "批發價",
    "收購價",
    "批發市場",
    "拍賣市場",
    "交易量",
    "到貨量",
    "盛產",
    "歉收",
    "減產",
    "滯銷",
    "供需失衡",
}
GENERAL_MARKET_CONTEXT_TERMS = {
    "價格",
    "供應",
    "庫存",
    "進口",
    "出口",
    "漲價",
    "跌價",
}
NEGATIVE_CONTEXT_TERMS_BY_CATEGORY = {
    "tech_brand": {
        "手機",
        "晶片",
        "iPhone",
        "iPad",
        "Mac",
        "App Store",
        "科技公司",
        "蘋果公司",
    },
    "finance": {"股價", "股票", "財報", "法人", "投資人"},
    "food": {"餐廳", "食譜", "料理", "菜單", "吃到飽", "優惠", "開箱"},
    "health": {"營養", "減肥", "保健", "熱量"},
    "entertainment": {"明星", "電影", "影集", "節目", "演唱會"},
}
TITLE_TOPIC_VETO_TERMS_BY_CATEGORY = {
    "health_nutrition": {
        "空腹",
        "營養",
        "熱量",
        "減肥",
        "血糖",
        "保健",
        "禁忌",
        "這類人",
        "千萬別",
        "怎麼吃",
        "吃法",
    },
    "home_storage": {
        "保存",
        "冰箱",
        "果蠅",
        "容易壞",
        "延長保存",
        "買回家",
        "清洗",
        "保鮮",
    },
    "food_cooking": {
        "餐廳",
        "食譜",
        "料理",
        "菜單",
        "吃到飽",
        "開箱",
        "甜點",
        "飲品",
    },
    "promotion_shopping": {
        "滿千送",
        "滿額",
        "贈送",
        "折扣",
        "優惠",
        "伴手禮",
        "開張",
        "開幕",
        "促銷",
        "抽獎",
    },
}
POLITICAL_GOVERNANCE_TITLE_TERMS = {
    "選舉",
    "政黨",
    "論壇",
    "兩岸",
    "治理",
    "立委",
    "議員",
    "市長",
    "縣長",
    "總統",
    "中央地方",
    "中央、地方",
}
SMART_AGRI_CONTEXT_TERMS = {
    "果園",
    "農場",
    "農地",
    "田間",
    "溫室",
    "型農",
    "農機",
    "智慧農業",
    "智慧農場",
    "栽培",
    "採收",
    "種植",
}
TITLE_STRONG_MARKET_TOPIC_TERMS = {
    "供應",
    "供需",
    "產量",
    "災損",
    "農損",
    "寒害",
    "採收",
    "產地價",
    "批發價",
    "菜價",
    "果價",
    "市場交易",
    "批發市場",
    "拍賣市場",
    "交易量",
    "到貨量",
    "出口",
    "進口",
}
TITLE_VETO_EXCEPTION_PRODUCTION_TERMS = {
    "採收",
    "栽培",
    "種植",
    "產量",
    "農損",
    "災損",
    "寒害",
    "病蟲害",
}
AMBIGUOUS_CROP_NEGATIVE_TERMS = {
    "蘋果": {"Apple", "iPhone", "iPad", "Mac", "庫克", "App Store", "蘋果公司"},
    "小米": {"小米集團", "Redmi", "雷軍", "手機", "科技公司"},
}
AMBIGUOUS_CROP_ALWAYS_NEGATIVE_TERMS = {
    "蘋果": {"Apple", "iPhone", "iPad", "Mac", "庫克", "App Store", "蘋果公司"},
    "小米": {"小米集團", "Redmi", "雷軍", "科技公司"},
}


@dataclass(frozen=True)
class YahooRelevanceDecision:
    is_relevant: bool
    score: int
    reason: str
    matched_crop_names: list[str] = field(default_factory=list)
    matched_positive_context_terms: list[str] = field(default_factory=list)
    matched_negative_context_terms: list[str] = field(default_factory=list)
    reason_code: str = ""

    def __iter__(self):
        yield self.is_relevant
        yield self.reason


@dataclass(frozen=True)
class YahooRelevanceStats:
    candidate_count: int = 0
    accepted_count: int = 0
    rejected_count: int = 0
    rejection_reasons: dict[str, int] = field(default_factory=dict)


_last_yahoo_relevance_stats = YahooRelevanceStats()


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


def _date_desc_value(value: Any) -> int:
    parsed = _compact_date_to_iso(value)
    if not parsed:
        return 0
    try:
        return datetime.fromisoformat(parsed).toordinal()
    except ValueError:
        return 0


def _yahoo_relevance_sort_key(article: dict[str, Any]) -> tuple[int, int, str]:
    return (
        -int(article.get("relevance_score") or 0),
        -_date_desc_value(article.get("published_date")),
        article.get("title") or "",
    )


def _add_matched_crop_name(article: dict[str, Any], crop_name: str) -> None:
    if not is_valid_yahoo_crop_name(crop_name):
        return
    matched = article.setdefault("matched_crop_names", [])
    if crop_name not in matched:
        matched.append(crop_name)


def _yahoo_card_mentions_crop(*, title: str, card_text: str, crop_name: str) -> bool:
    return crop_name in title or crop_name in card_text


def _find_terms(text: str, terms: set[str]) -> list[str]:
    return sorted(term for term in terms if term in text)


def is_valid_yahoo_crop_name(crop_name: Any) -> bool:
    normalized = str(crop_name or "").strip()
    return bool(normalized) and normalized not in YAHOO_EXCLUDED_CROP_NAMES


def normalize_yahoo_crop_names(crop_names: list[str] | None) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw_crop_name in crop_names or []:
        crop_name = str(raw_crop_name or "").strip()
        if is_valid_yahoo_crop_name(crop_name) and crop_name not in seen:
            normalized.append(crop_name)
            seen.add(crop_name)
    return normalized


def _negative_context_matches(text: str) -> dict[str, list[str]]:
    matches: dict[str, list[str]] = {}
    for category, terms in NEGATIVE_CONTEXT_TERMS_BY_CATEGORY.items():
        found = _find_terms(text, terms)
        if found:
            matches[category] = found
    return matches


def _flatten_context_matches(matches: dict[str, list[str]]) -> list[str]:
    flattened: list[str] = []
    for category in sorted(matches):
        for term in matches[category]:
            flattened.append(f"{category}:{term}")
    return flattened


def _title_has_clear_agri_topic(title: str) -> bool:
    return _title_has_production_or_smart_topic(title) or _title_has_price_supply_or_market_topic(title)


def _title_has_production_or_smart_topic(title: str) -> bool:
    return bool(_find_terms(title, AGRI_PRODUCTION_CONTEXT_TERMS))


def _title_has_smart_agri_context(title: str) -> bool:
    return bool(_find_terms(title, SMART_AGRI_CONTEXT_TERMS))


def _title_mentions_matched_crop(title: str, matched_crop_names: list[str]) -> bool:
    return any(crop_name in title for crop_name in matched_crop_names)


def _title_has_price_supply_or_market_topic(title: str) -> bool:
    return bool(_find_terms(title, AGRI_MARKET_CONTEXT_TERMS | TITLE_STRONG_MARKET_TOPIC_TERMS))


def _title_has_veto_exception_topic(title: str) -> bool:
    return bool(
        _find_terms(
            title,
            TITLE_VETO_EXCEPTION_PRODUCTION_TERMS
            | SMART_AGRI_CONTEXT_TERMS
            | AGRI_MARKET_CONTEXT_TERMS
            | TITLE_STRONG_MARKET_TOPIC_TERMS,
        )
    )


def _title_topic_veto_decision(
    *,
    title: str,
    matched_crop_names: list[str],
) -> YahooRelevanceDecision | None:
    clear_agri_topic = _title_has_clear_agri_topic(title)
    veto_exception_topic = _title_has_veto_exception_topic(title)

    for category, terms in TITLE_TOPIC_VETO_TERMS_BY_CATEGORY.items():
        matched_terms = _find_terms(title, terms)
        if not matched_terms:
            continue
        if category == "promotion_shopping":
            if _title_has_price_supply_or_market_topic(title):
                continue
        elif veto_exception_topic:
            continue
        return _reject_yahoo_relevance(
            f"title_topic_{category}",
            f"title is primarily {category} context: {', '.join(matched_terms[:4])}",
            matched_crop_names=matched_crop_names,
            matched_negative_context_terms=[f"{category}:{term}" for term in matched_terms],
        )

    political_terms = _find_terms(title, POLITICAL_GOVERNANCE_TITLE_TERMS)
    if (
        political_terms
        and not clear_agri_topic
        and not _title_mentions_matched_crop(title, matched_crop_names)
    ):
        return _reject_yahoo_relevance(
            "title_topic_political_governance",
            "title is primarily political or governance context: "
            f"{', '.join(political_terms[:4])}",
            matched_crop_names=matched_crop_names,
            matched_negative_context_terms=[
                f"political_governance:{term}" for term in political_terms
            ],
        )

    return None


def _terms_near_crop(
    *,
    text: str,
    crop_name: str,
    terms: set[str],
    window_chars: int = AGRI_CONTEXT_WINDOW_CHARS,
) -> list[str]:
    if not text or not crop_name:
        return []

    matched_terms: set[str] = set()
    for crop_match in re.finditer(re.escape(crop_name), text):
        start = max(0, crop_match.start() - window_chars)
        end = min(len(text), crop_match.end() + window_chars)
        window = text[start:end]
        matched_terms.update(term for term in terms if term in window)
    return sorted(matched_terms)


def _has_agri_context_near_crop(
    *,
    text: str,
    crop_name: str,
    terms: set[str],
    window_chars: int = AGRI_CONTEXT_WINDOW_CHARS,
) -> bool:
    return bool(
        _terms_near_crop(
            text=text,
            crop_name=crop_name,
            terms=terms,
            window_chars=window_chars,
        )
    )


def _crop_ambiguity_terms(crop_name: str, text: str) -> list[str]:
    terms = AMBIGUOUS_CROP_NEGATIVE_TERMS.get(crop_name, set())
    return _find_terms(text, terms)


def _reject_yahoo_relevance(
    reason_code: str,
    reason: str,
    *,
    score: int = 0,
    matched_crop_names: list[str] | None = None,
    matched_positive_context_terms: list[str] | None = None,
    matched_negative_context_terms: list[str] | None = None,
) -> YahooRelevanceDecision:
    return YahooRelevanceDecision(
        is_relevant=False,
        score=score,
        reason=reason,
        matched_crop_names=matched_crop_names or [],
        matched_positive_context_terms=matched_positive_context_terms or [],
        matched_negative_context_terms=matched_negative_context_terms or [],
        reason_code=reason_code,
    )


def evaluate_yahoo_relevance(
    *,
    title: str,
    content_text: str | None,
    matched_crop_names: list[str],
) -> YahooRelevanceDecision:
    normalized_crops = normalize_yahoo_crop_names(matched_crop_names)
    if not normalized_crops:
        return _reject_yahoo_relevance("no_crop", "no matched crop names")

    body = content_text or ""
    combined_text = f"{title}\n{body}"
    title_production_terms = _find_terms(title, AGRI_PRODUCTION_CONTEXT_TERMS)
    title_negative_matches = _negative_context_matches(title)
    title_negative_terms = _flatten_context_matches(title_negative_matches)
    title_has_clear_agri_topic = _title_has_clear_agri_topic(title)

    topic_veto = _title_topic_veto_decision(
        title=title,
        matched_crop_names=normalized_crops,
    )
    if topic_veto:
        return topic_veto

    for crop_name in normalized_crops:
        ambiguous_terms = _crop_ambiguity_terms(crop_name, title)
        if crop_name in AMBIGUOUS_CROP_NEGATIVE_TERMS and crop_name in title:
            always_negative_terms = _find_terms(
                title,
                AMBIGUOUS_CROP_ALWAYS_NEGATIVE_TERMS.get(crop_name, set()),
            )
            contextual_terms = (
                ambiguous_terms
                + title_negative_matches.get("tech_brand", [])
                + title_negative_matches.get("finance", [])
            )
            if always_negative_terms or (
                contextual_terms and not _title_has_smart_agri_context(title)
            ):
                ambiguous_terms = sorted(set(always_negative_terms + contextual_terms))
            else:
                ambiguous_terms = []
        if ambiguous_terms:
            return _reject_yahoo_relevance(
                "ambiguous_crop_negative_title",
                f"ambiguous crop '{crop_name}' matched non-agriculture title context: "
                f"{', '.join(ambiguous_terms[:3])}",
                matched_crop_names=[crop_name],
                matched_negative_context_terms=ambiguous_terms,
            )

    if title_negative_terms and not title_has_clear_agri_topic:
        return _reject_yahoo_relevance(
            "negative_title_without_agri_context",
            "title contains negative context without agriculture production context: "
            f"{', '.join(title_negative_terms[:4])}",
            matched_negative_context_terms=title_negative_terms,
        )

    best_decision: YahooRelevanceDecision | None = None
    for crop_name in normalized_crops:
        ambiguous_terms = _crop_ambiguity_terms(crop_name, combined_text)
        if ambiguous_terms:
            candidate_decision = _reject_yahoo_relevance(
                "ambiguous_crop_negative_context",
                f"ambiguous crop '{crop_name}' matched non-agriculture context: "
                f"{', '.join(ambiguous_terms[:3])}",
                matched_crop_names=[crop_name],
                matched_negative_context_terms=ambiguous_terms,
            )
            if best_decision is None or candidate_decision.score > best_decision.score:
                best_decision = candidate_decision
            continue

        if len(crop_name) == 1:
            if crop_name not in title:
                candidate_decision = _reject_yahoo_relevance(
                    "single_crop_missing_title",
                    f"single-character crop '{crop_name}' is not in title",
                    matched_crop_names=[crop_name],
                )
                if best_decision is None or candidate_decision.score > best_decision.score:
                    best_decision = candidate_decision
                continue

            nearby_production_terms = _terms_near_crop(
                text=combined_text,
                crop_name=crop_name,
                terms=AGRI_PRODUCTION_CONTEXT_TERMS,
                window_chars=SINGLE_CROP_CONTEXT_WINDOW_CHARS,
            )
            if not (title_production_terms or nearby_production_terms):
                candidate_decision = _reject_yahoo_relevance(
                    "single_crop_missing_strong_context",
                    f"single-character crop '{crop_name}' lacks title or nearby production context",
                    matched_crop_names=[crop_name],
                )
                if best_decision is None or candidate_decision.score > best_decision.score:
                    best_decision = candidate_decision
                continue

            positive_terms = sorted(set(title_production_terms + nearby_production_terms))
            score = 3 + 4 + min(2, len(positive_terms))
            return YahooRelevanceDecision(
                is_relevant=True,
                score=score,
                reason=(
                    f"single-character crop '{crop_name}' matched in title with nearby "
                    f"production context: {', '.join(positive_terms[:4])}"
                ),
                matched_crop_names=[crop_name],
                matched_positive_context_terms=positive_terms,
                matched_negative_context_terms=title_negative_terms,
                reason_code="accepted_single_crop_with_production_context",
            )

        title_has_crop = crop_name in title
        body_crop_count = body.count(crop_name)
        if not title_has_crop and body_crop_count < 2:
            candidate_decision = _reject_yahoo_relevance(
                "crop_frequency_not_met",
                f"crop '{crop_name}' is not in title and appears fewer than twice in body",
                matched_crop_names=[crop_name],
            )
            if best_decision is None or candidate_decision.score > best_decision.score:
                best_decision = candidate_decision
            continue

        nearby_production_terms = _terms_near_crop(
            text=combined_text,
            crop_name=crop_name,
            terms=AGRI_PRODUCTION_CONTEXT_TERMS,
        )
        nearby_market_terms = _terms_near_crop(
            text=combined_text,
            crop_name=crop_name,
            terms=AGRI_MARKET_CONTEXT_TERMS,
        )
        nearby_general_terms = _terms_near_crop(
            text=combined_text,
            crop_name=crop_name,
            terms=GENERAL_MARKET_CONTEXT_TERMS,
        )
        positive_terms = sorted(set(nearby_production_terms + nearby_market_terms))
        if not positive_terms:
            candidate_decision = _reject_yahoo_relevance(
                "missing_nearby_agri_context",
                f"crop '{crop_name}' lacks nearby agriculture production or agri-market context",
                matched_crop_names=[crop_name],
                matched_negative_context_terms=title_negative_terms,
            )
            if best_decision is None or candidate_decision.score > best_decision.score:
                best_decision = candidate_decision
            continue

        score = 0
        if title_has_crop:
            score += 4
        if body_crop_count >= 2:
            score += 3
        if nearby_production_terms:
            score += 4
        if nearby_market_terms:
            score += 3
        if title_production_terms:
            score += 1
        if nearby_general_terms and positive_terms:
            score += 1

        if score >= YAHOO_RELEVANCE_SCORE_THRESHOLD:
            return YahooRelevanceDecision(
                is_relevant=True,
                score=score,
                reason=(
                    f"crop '{crop_name}' matched with score={score}; nearby positive context: "
                    f"{', '.join(positive_terms[:5])}"
                ),
                matched_crop_names=[crop_name],
                matched_positive_context_terms=positive_terms + nearby_general_terms,
                matched_negative_context_terms=title_negative_terms,
                reason_code="accepted_crop_with_nearby_context",
            )

        candidate_decision = _reject_yahoo_relevance(
            "score_below_threshold",
            f"crop '{crop_name}' matched nearby context but score {score} is below threshold",
            score=score,
            matched_crop_names=[crop_name],
            matched_positive_context_terms=positive_terms + nearby_general_terms,
            matched_negative_context_terms=title_negative_terms,
        )
        if best_decision is None or candidate_decision.score > best_decision.score:
            best_decision = candidate_decision

    return best_decision or _reject_yahoo_relevance(
        "missing_required_context",
        "missing required crop frequency or nearby agriculture context",
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
        if is_valid_yahoo_crop_name(normalized) and normalized not in seen_keywords:
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


def get_last_yahoo_relevance_stats() -> YahooRelevanceStats:
    return _last_yahoo_relevance_stats


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
    global _last_yahoo_relevance_stats

    candidates = fetch_yahoo_news_list(yahoo_keywords, limit=candidate_limit)
    accepted: list[dict[str, Any]] = []
    rejection_reasons: Counter[str] = Counter()

    for candidate in candidates:
        detail = fetch_yahoo_article_content(candidate["source_url"])
        article = _merge_article(candidate, detail)
        decision = evaluate_yahoo_relevance(
            title=article.get("title") or "",
            content_text=article.get("content_text"),
            matched_crop_names=article.get("matched_crop_names", []),
        )
        if not decision.is_relevant:
            article["rejection_reason"] = decision.reason
            rejection_reasons[decision.reason_code or decision.reason] += 1
            continue
        article["relevance_score"] = decision.score
        article["relevance_reason"] = decision.reason
        article["matched_crop_names"] = decision.matched_crop_names
        accepted.append(article)

    _last_yahoo_relevance_stats = YahooRelevanceStats(
        candidate_count=len(candidates),
        accepted_count=len(accepted),
        rejected_count=len(candidates) - len(accepted),
        rejection_reasons=dict(sorted(rejection_reasons.items())),
    )

    accepted.sort(key=_yahoo_relevance_sort_key)
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
    threads_articles = fetch_threads_posts(limit=min(limit_per_source, 10))

    if not any(items for items, _detail_fetcher in source_jobs) and not yahoo_articles and not threads_articles:
        raise RuntimeError("Unable to fetch any agriculture news list data.")

    articles: list[dict[str, Any]] = []
    for items, detail_fetcher in source_jobs:
        for item in items:
            detail = detail_fetcher(item["source_url"])
            articles.append(_merge_article(item, detail))

    articles.extend(yahoo_articles)
    articles.extend(threads_articles)
    return articles
