import hashlib

import pytest

from src.data import fetch_agri_news as news


MOA_LIST_HTML = """
<html><body>
  <div class="no-more-tables">
    <table><tbody>
      <tr>
        <td>10036</td>
        <td>115-07-12</td>
        <td>
          <a title="農業部測試新聞" href="/theme_data.php?theme=news&sub_theme=agri&id=10209">
            農業部測試新聞
          </a>
        </td>
      </tr>
    </tbody></table>
  </div>
</body></html>
"""


AFA_LIST_HTML = """
<html><body>
  <a class="agricultural-news"
     title="農糧署測試新聞"
     href="index.php?code=list&flag=detail&ids=307&article_id=33828">
    <div class="agricultural-news-ribbon"><span>115-07-12</span></div>
    <h3>農糧署測試新聞</h3>
  </a>
</body></html>
"""


MOA_DETAIL_HTML = """
<html><body>
  <div id="content">
    <h2 class="fs-3 mb-3">農業部測試新聞</h2>
    <p>發布日期：115-07-12</p>
    <div class="share">分享到 Facebook</div>
    <div class="edit lh-lg">
      <p>第一段農業部正文。</p>
      <p>第二段農業部正文。</p>
    </div>
  </div>
</body></html>
"""


AFA_DETAIL_HTML = """
<html><body>
  <div id="content">
    <h3>農糧署測試新聞</h3>
    <p>發布日期：115-07-12</p>
    <article class="shared-content-text">
      <p>第一段農糧署正文。</p>
      <div class="share">分享到 Line</div>
      <p>第二段農糧署正文。</p>
    </article>
  </div>
</body></html>
"""


def test_fetch_moa_news_list_parses_title_date_id_and_absolute_url(monkeypatch):
    monkeypatch.setattr(news, "_get_html", lambda url: MOA_LIST_HTML)

    items = news.fetch_moa_news_list(limit=1)

    assert items[0]["source_name"] == "農業部"
    assert items[0]["source_article_id"] == "10036"
    assert items[0]["title"] == "農業部測試新聞"
    assert items[0]["published_date"] == "2026-07-12"
    assert items[0]["source_url"] == (
        "https://www.moa.gov.tw/theme_data.php?id=10209&sub_theme=agri&theme=news"
    )


def test_fetch_afa_news_list_parses_title_date_id_and_absolute_url(monkeypatch):
    monkeypatch.setattr(news, "_get_html", lambda url: AFA_LIST_HTML)

    items = news.fetch_afa_news_list(limit=1)

    assert items[0]["source_name"] == "農糧署"
    assert items[0]["source_article_id"] == "33828"
    assert items[0]["title"] == "農糧署測試新聞"
    assert items[0]["published_date"] == "2026-07-12"
    assert items[0]["source_url"] == (
        "https://www.afa.gov.tw/cht/index.php?article_id=33828&code=list&flag=detail&ids=307"
    )


def test_roc_date_converts_to_western_date():
    assert news._roc_date_to_iso("115-07-12") == "2026-07-12"


def test_article_key_is_stable_for_same_normalized_url():
    first = news._article_key("https://www.moa.gov.tw/theme_data.php?theme=news&id=1#main")
    second = news._article_key("https://www.moa.gov.tw/theme_data.php?id=1&theme=news")

    assert first == second


def test_fetch_moa_article_content_extracts_clean_content(monkeypatch):
    monkeypatch.setattr(news, "_get_html", lambda url: MOA_DETAIL_HTML)

    article = news.fetch_moa_article_content(
        "https://www.moa.gov.tw/theme_data.php?theme=news&sub_theme=agri&id=10209"
    )

    assert article["parse_status"] == "success"
    assert article["title"] == "農業部測試新聞"
    assert article["published_date"] == "2026-07-12"
    assert article["content_text"] == "第一段農業部正文。\n第二段農業部正文。"
    assert "Facebook" not in article["content_text"]


def test_fetch_afa_article_content_extracts_clean_content(monkeypatch):
    monkeypatch.setattr(news, "_get_html", lambda url: AFA_DETAIL_HTML)

    article = news.fetch_afa_article_content(
        "https://www.afa.gov.tw/cht/index.php?code=list&flag=detail&ids=307&article_id=33828"
    )

    assert article["parse_status"] == "success"
    assert article["title"] == "農糧署測試新聞"
    assert article["published_date"] == "2026-07-12"
    assert article["content_text"] == "第一段農糧署正文。\n第二段農糧署正文。"
    assert "Line" not in article["content_text"]


def test_content_hash_uses_sha256(monkeypatch):
    monkeypatch.setattr(news, "_get_html", lambda url: MOA_DETAIL_HTML)

    article = news.fetch_moa_article_content(
        "https://www.moa.gov.tw/theme_data.php?theme=news&sub_theme=agri&id=10209"
    )

    assert article["content_hash"] == hashlib.sha256(
        article["content_text"].encode("utf-8")
    ).hexdigest()


def test_article_parse_failure_returns_failed_status(monkeypatch):
    monkeypatch.setattr(news, "_get_html", lambda url: "<html><body>missing content</body></html>")

    article = news.fetch_moa_article_content(
        "https://www.moa.gov.tw/theme_data.php?theme=news&sub_theme=agri&id=10209"
    )

    assert article["source_name"] == "農業部"
    assert article["source_url"] == (
        "https://www.moa.gov.tw/theme_data.php?id=10209&sub_theme=agri&theme=news"
    )
    assert article["parse_status"] == "failed"
    assert "selector not found" in article["parse_error"]


def test_fetch_agri_news_merges_sources_and_keeps_going_after_article_failure(monkeypatch):
    moa_base = news._empty_article(
        source_name="農業部",
        source_article_id="10036",
        title="農業部測試新聞",
        published_date="2026-07-12",
        source_url="https://www.moa.gov.tw/theme_data.php?theme=news&sub_theme=agri&id=10209",
    )
    afa_base = news._empty_article(
        source_name="農糧署",
        source_article_id="33828",
        title="農糧署測試新聞",
        published_date="2026-07-12",
        source_url="https://www.afa.gov.tw/cht/index.php?code=list&flag=detail&ids=307&article_id=33828",
    )
    monkeypatch.setattr(news, "fetch_moa_news_list", lambda limit: [moa_base])
    monkeypatch.setattr(news, "fetch_afa_news_list", lambda limit: [afa_base])
    monkeypatch.setattr(
        news,
        "fetch_moa_article_content",
        lambda url: news._empty_article(
            source_name="農業部",
            source_url=url,
            parse_status="failed",
            parse_error="boom",
        ),
    )
    monkeypatch.setattr(
        news,
        "fetch_afa_article_content",
        lambda url: {
            **afa_base,
            "content_text": "農糧署正文",
            "content_hash": news._content_hash("農糧署正文"),
            "parse_status": "success",
            "parse_error": None,
        },
    )

    items = news.fetch_agri_news(limit_per_source=1)

    assert len(items) == 2
    assert items[0]["title"] == "農業部測試新聞"
    assert items[0]["parse_status"] == "failed"
    assert items[0]["parse_error"] == "boom"
    assert items[1]["source_name"] == "農糧署"
    assert items[1]["parse_status"] == "success"


def test_fetch_agri_news_raises_when_both_lists_empty(monkeypatch):
    monkeypatch.setattr(news, "fetch_moa_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_afa_news_list", lambda limit: [])

    with pytest.raises(RuntimeError, match="Unable to fetch any agriculture news list data"):
        news.fetch_agri_news(limit_per_source=1)
