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


PTT_LIST_HTML = """
<html><body>
  <div class="r-ent">
    <div class="title">
      <a href="/bbs/Fruits/M.1784033014.A.94C.html">[廣宣] 黃肉，白玉 一條龍榴槤蜜</a>
    </div>
  </div>
  <div class="r-list-sep"></div>
  <div class="r-ent">
    <div class="title"><a href="/bbs/Fruits/M.STICKY.AAAA.html">置底公告</a></div>
  </div>
</body></html>
"""


PTT_DETAIL_HTML = """
<html><body>
  <div id="main-content">
    <div class="article-metaline">
      <span class="article-meta-tag">作者</span>
      <span class="article-meta-value">seller (水果小農)</span>
    </div>
    <div class="article-metaline">
      <span class="article-meta-tag">看板</span>
      <span class="article-meta-value">Fruits</span>
    </div>
    <div class="article-metaline">
      <span class="article-meta-tag">標題</span>
      <span class="article-meta-value">[廣宣] 黃肉，白玉 一條龍榴槤蜜</span>
    </div>
    <div class="article-metaline">
      <span class="article-meta-tag">時間</span>
      <span class="article-meta-value">Tue Jul 14 12:03:34 2026</span>
    </div>
    這是第一段 PTT 正文。
    這是第二段 PTT 正文。
    <div class="push"><span class="push-content">: 推文不應進正文</span></div>
    <span class="f2">※ 發信站: 批踢踢實業坊(ptt.cc), 來自: 127.0.0.1</span>
  </div>
</body></html>
"""


AGRIHARVEST_LIST_HTML = """
<html><body>
  <article>
    <a class="post-title" href="https://www.agriharvest.tw/archives/137488/">
      農傳媒測試新聞
    </a>
    <li class="post-date">20260715</li>
  </article>
</body></html>
"""


AGRIHARVEST_DETAIL_HTML = """
<html><body>
  <article>
    <h1 class="entry-title">農傳媒測試新聞</h1>
    <time datetime="2026-07-15T08:00:00+08:00"></time>
    <div class="entry-content">
      <p>第一段農傳媒正文。</p>
      <div class="share">分享按鈕</div>
      <div class="related">延伸閱讀：不要進正文</div>
      <p>第二段農傳媒正文。</p>
      <div class="tags">標籤：農業</div>
    </div>
  </article>
</body></html>
"""


YAHOO_SEARCH_HTML = """
<html><body>
  <li class="stream-card">
    <h3>
      <a href="/%E8%8A%92%E6%9E%9C-news-111.html">[自由時報] 芒果價格上揚</a>
    </h3>
    <div class="text-px12">自由時報 ・ 2026年7月15日</div>
  </li>
  <li class="stream-card">
    <h3>
      <a href="/duplicate-news-222.html">[三立新聞網 setn.com] 芒果產地採收順利</a>
    </h3>
    <div class="text-px12">三立新聞網 setn.com ・ 2026年7月14日</div>
  </li>
</body></html>
"""


YAHOO_SEARCH_DUPLICATE_HTML = """
<html><body>
  <li class="stream-card">
    <h3>
      <a href="/duplicate-news-222.html">[三立新聞網 setn.com] 香蕉產地採收順利</a>
    </h3>
    <div class="text-px12">三立新聞網 setn.com ・ 2026年7月14日</div>
  </li>
</body></html>
"""


YAHOO_DETAIL_HTML = """
<html><body>
  <article>
    <h1>芒果價格上揚</h1>
    <time datetime="2026-07-15T10:30:00+08:00"></time>
    <div class="caas-body">
      <p>第一段 Yahoo 正文。</p>
      <div class="caas-share-buttons">分享</div>
      <p>第二段 Yahoo 正文。</p>
      <div class="caas-readmore">延伸閱讀</div>
    </div>
  </article>
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


def test_fetch_ptt_fruits_news_list_parses_latest_non_sticky_article(monkeypatch):
    monkeypatch.setattr(news, "_get_html", lambda url, **kwargs: PTT_LIST_HTML)

    items = news.fetch_ptt_fruits_news_list(limit=1)

    assert items[0]["source_name"] == "PTT Fruits"
    assert items[0]["crawl_source"] == "ptt_fruits"
    assert items[0]["source_article_id"] == "M.1784033014.A.94C"
    assert items[0]["title"] == "[廣宣] 黃肉，白玉 一條龍榴槤蜜"
    assert items[0]["source_url"] == "https://www.ptt.cc/bbs/Fruits/M.1784033014.A.94C.html"


def test_fetch_ptt_fruits_article_content_removes_metadata_pushes_and_ip(monkeypatch):
    monkeypatch.setattr(news, "_get_html", lambda url, **kwargs: PTT_DETAIL_HTML)

    article = news.fetch_ptt_fruits_article_content(
        "https://www.ptt.cc/bbs/Fruits/M.1784033014.A.94C.html"
    )

    assert article["parse_status"] == "success"
    assert article["published_date"] == "2026-07-14"
    assert article["content_text"] == "這是第一段 PTT 正文。\n這是第二段 PTT 正文。"
    assert "作者" not in article["content_text"]
    assert "推文" not in article["content_text"]
    assert "127.0.0.1" not in article["content_text"]
    assert article["content_hash"] == hashlib.sha256(
        article["content_text"].encode("utf-8")
    ).hexdigest()


def test_fetch_agriharvest_news_list_parses_title_date_and_url(monkeypatch):
    monkeypatch.setattr(news, "_get_html", lambda url: AGRIHARVEST_LIST_HTML)

    items = news.fetch_agriharvest_news_list(limit=1)

    assert items[0]["source_name"] == "農傳媒"
    assert items[0]["crawl_source"] == "agriharvest"
    assert items[0]["source_article_id"] == "137488"
    assert items[0]["title"] == "農傳媒測試新聞"
    assert items[0]["published_date"] == "2026-07-15"


def test_fetch_agriharvest_article_content_extracts_clean_body(monkeypatch):
    monkeypatch.setattr(news, "_get_html", lambda url: AGRIHARVEST_DETAIL_HTML)

    article = news.fetch_agriharvest_article_content(
        "https://www.agriharvest.tw/archives/137488/"
    )

    assert article["parse_status"] == "success"
    assert article["content_text"] == "第一段農傳媒正文。\n第二段農傳媒正文。"
    assert "延伸閱讀" not in article["content_text"]
    assert "分享" not in article["content_text"]
    assert article["content_hash"] == hashlib.sha256(
        article["content_text"].encode("utf-8")
    ).hexdigest()


def test_yahoo_search_url_uses_given_keyword_and_url_encoding():
    url = news.build_yahoo_search_url("愛文 芒果")

    assert "高麗菜" not in url
    assert url.endswith("?p=%E6%84%9B%E6%96%87%20%E8%8A%92%E6%9E%9C")


def test_fetch_yahoo_news_list_dedupes_splits_source_and_title(monkeypatch):
    requested_urls = []

    def fake_get_html(url):
        requested_urls.append(url)
        if "%E8%8A%92%E6%9E%9C" in url:
            return YAHOO_SEARCH_HTML
        return YAHOO_SEARCH_DUPLICATE_HTML

    monkeypatch.setattr(news, "_get_html", fake_get_html)
    monkeypatch.setattr(news, "YAHOO_SEARCH_DELAY_SECONDS", 0)

    items = news.fetch_yahoo_news_list(["芒果", "香蕉"], limit=10)

    assert all("高麗菜" not in url for url in requested_urls)
    assert len(items) == 2
    assert items[0]["source_name"] == "自由時報"
    assert items[0]["title"] == "芒果價格上揚"
    assert not items[0]["title"].startswith("[")
    assert items[1]["source_name"] == "三立新聞網 setn.com"
    assert items[1]["matched_crop_names"] == ["芒果", "香蕉"]


def test_fetch_yahoo_news_list_filters_cards_that_do_not_mention_search_crop(monkeypatch):
    html = """
    <html><body>
      <li class="stream-card">
        <h3><a href="/phone-101.html">[科技網] 蘋果發表新手機</a></h3>
        <div class="text-px12">科技網 ・ 2026年7月15日</div>
      </li>
      <li class="stream-card">
        <h3><a href="/banana-102.html">[自由時報] 香蕉產地供應減少</a></h3>
        <div class="text-px12">自由時報 ・ 2026年7月15日</div>
      </li>
    </body></html>
    """
    monkeypatch.setattr(news, "_get_html", lambda url: html)

    items = news.fetch_yahoo_news_list(["香蕉"], limit=10)

    assert len(items) == 1
    assert items[0]["title"] == "香蕉產地供應減少"


def test_fetch_yahoo_news_list_candidate_limit_is_sixty(monkeypatch):
    cards = "\n".join(
        f"""
        <li class="stream-card">
          <h3><a href="/article-{index}-123{index}.html">[自由時報] 芒果產地新聞 {index}</a></h3>
          <div class="text-px12">自由時報 ・ 2026年7月{index + 1:02d}日</div>
        </li>
        """
        for index in range(70)
    )
    monkeypatch.setattr(news, "_get_html", lambda url: f"<html><body>{cards}</body></html>")

    items = news.fetch_yahoo_news_list(["芒果"], limit=50)

    assert len(items) == 50

    items = news.fetch_yahoo_news_list(["芒果"], limit=100)

    assert len(items) == news.YAHOO_CANDIDATE_LIMIT


def test_fetch_yahoo_article_content_extracts_clean_body(monkeypatch):
    monkeypatch.setattr(news, "_get_html", lambda url: YAHOO_DETAIL_HTML)

    article = news.fetch_yahoo_article_content(
        "https://tw.news.yahoo.com/%E8%8A%92%E6%9E%9C-news-111.html"
    )

    assert article["parse_status"] == "success"
    assert article["content_text"] == "第一段 Yahoo 正文。\n第二段 Yahoo 正文。"
    assert "分享" not in article["content_text"]
    assert "延伸閱讀" not in article["content_text"]
    assert article["content_hash"] == hashlib.sha256(
        article["content_text"].encode("utf-8")
    ).hexdigest()


@pytest.mark.parametrize(
    ("title", "content_text", "matched_crop_names", "expected"),
    [
        ("高麗菜價格崩跌，農民棄採", "產地供應量增加。", ["高麗菜"], True),
        ("高麗菜絲免費加，豬排定食限時 199 元", "餐廳活動。", ["高麗菜"], False),
        ("蘋果發表新手機", "新款手機上市。", ["蘋果"], False),
        ("蘋果產地受寒害，果農採收延後", "農民表示採收延後。", ["蘋果"], True),
        ("蔥價上漲", "農民提前採收。", ["蔥"], True),
        ("明星推薦蔥油餅店", "餐廳料理優惠。", ["蔥"], False),
        ("市場行情", "農民表示高麗菜供應穩定。", ["高麗菜"], False),
        ("市場行情", "農民表示高麗菜供應穩定，高麗菜採收增加。", ["高麗菜"], True),
        (
            "市場行情",
            "今日產地回報高麗菜到貨量增加，農民表示高麗菜採收順利。",
            ["高麗菜"],
            True,
        ),
        ("蘋果公司供應鏈庫存回升，產品價格調整", "法人看好新機銷售。", ["蘋果"], False),
        ("農業科技公司與蘋果合作開發新手機", "晶片規格升級。", ["蘋果"], False),
        ("小米手機出口成長，庫存下降", "投資人關注財報。", ["小米"], False),
        ("高麗菜料理價格上漲，餐廳供應吃到飽", "菜單優惠更新。", ["高麗菜"], False),
        ("明星推薦蔥油餅，原料價格上漲", "節目介紹餐廳料理。", ["蔥"], False),
        ("早餐空腹吃香蕉超讚！這4類人千萬別碰", "香蕉種植產地採收資訊。", ["香蕉"], False),
        ("香蕉容易壞？買回家先做1動作延長保存", "香蕉採收後上市。", ["香蕉"], False),
        ("高麗菜料理這樣做最好吃", "高麗菜產地農民採收。", ["高麗菜"], False),
        ("酪梨、紅豆激盪美味 萬丹農會創意料理大比拼", "酪梨產量與拍賣市場資訊。", ["酪梨"], False),
        ("芒果甜點限時優惠", "芒果產地農民採收。", ["芒果"], False),
        ("小農平台開張滿千送伴手禮", "芒果酪梨產地小農供應。", ["芒果", "酪梨"], False),
        ("海峽論壇談中央地方治理", "正文提及釋迦農民與產地。", ["釋迦"], False),
        ("手機管理16公頃果園，型農打造酪梨智慧農場", "酪梨果園導入灌溉。", ["酪梨"], True),
        ("果園導入感測器監測灌溉", "酪梨果園採用感測器，酪梨農民追蹤灌溉。", ["酪梨"], True),
        ("高麗菜產地供應增加，批發價下跌", "高麗菜到貨量同步增加。", ["高麗菜"], True),
        ("香蕉寒害造成產量下降", "農民表示香蕉採收延後。", ["香蕉"], True),
        ("蘋果產地採收延後", "果農表示蘋果受天候影響。", ["蘋果"], True),
    ],
)
def test_evaluate_yahoo_relevance_rules(title, content_text, matched_crop_names, expected):
    decision = news.evaluate_yahoo_relevance(
        title=title,
        content_text=content_text,
        matched_crop_names=matched_crop_names,
    )

    assert decision.is_relevant is expected
    assert decision.reason
    assert isinstance(decision.score, int)


def test_yahoo_context_terms_must_be_near_crop():
    far_content = (
        "高麗菜今日在城市活動中被提及，民眾分享童年回憶。"
        + "這是一段沒有相關脈絡的文字。" * 10
        + "農民表示近期採收與產地管理順利。"
        + "這是另一段沒有相關脈絡的文字。" * 10
        + "高麗菜再次出現在餐飲評論中。"
    )

    decision = news.evaluate_yahoo_relevance(
        title="市場活動",
        content_text=far_content,
        matched_crop_names=["高麗菜"],
    )

    assert decision.is_relevant is False
    assert decision.reason_code == "missing_nearby_agri_context"


def test_single_character_crop_rejects_repeated_character_without_agri_context():
    decision = news.evaluate_yahoo_relevance(
        title="市場話題",
        content_text="蔥明消費者分享蔥容生活，內容多次出現蔥字但沒有農業脈絡。",
        matched_crop_names=["蔥"],
    )

    assert decision.is_relevant is False
    assert decision.reason_code == "single_crop_missing_title"


def test_terms_near_crop_uses_configured_window():
    near_text = "高麗菜" + ("x" * (news.AGRI_CONTEXT_WINDOW_CHARS - 2)) + "農民"
    far_text = "高麗菜" + ("x" * (news.AGRI_CONTEXT_WINDOW_CHARS + 1)) + "農民"

    assert news._has_agri_context_near_crop(
        text=near_text,
        crop_name="高麗菜",
        terms=news.AGRI_PRODUCTION_CONTEXT_TERMS,
    )
    assert not news._has_agri_context_near_crop(
        text=far_text,
        crop_name="高麗菜",
        terms=news.AGRI_PRODUCTION_CONTEXT_TERMS,
    )


def test_yahoo_crop_name_cleanup_removes_only_known_non_crop_values():
    assert news.normalize_yahoo_crop_names(["其他", "休市", "蔥", " 蔥 ", ""]) == ["蔥"]
    assert news.is_valid_yahoo_crop_name("蔥")


def test_fetch_yahoo_news_list_does_not_match_excluded_crop_names(monkeypatch):
    html = """
    <html><body>
      <li class="stream-card">
        <h3><a href="/other-101.html">[新聞網] 其他產地採收新聞</a></h3>
        <div class="text-px12">新聞網 ・ 2026年7月15日</div>
      </li>
      <li class="stream-card">
        <h3><a href="/scallion-102.html">[自由時報] 蔥產地採收順利</a></h3>
        <div class="text-px12">自由時報 ・ 2026年7月15日</div>
      </li>
    </body></html>
    """
    requested_urls = []

    def fake_get_html(url):
        requested_urls.append(url)
        return html

    monkeypatch.setattr(news, "_get_html", fake_get_html)

    items = news.fetch_yahoo_news_list(["其他", "休市", "蔥"], limit=10)

    assert len(items) == 1
    assert items[0]["matched_crop_names"] == ["蔥"]
    assert len(requested_urls) == 1
    assert "other" not in items[0]["source_url"]


def test_fetch_relevant_yahoo_articles_returns_at_most_ten(monkeypatch):
    candidates = [
        news._empty_article(
            source_name="自由時報",
            title=f"芒果產地新聞 {index}",
            source_url=f"https://tw.news.yahoo.com/article-{index}-123{index}.html",
            crawl_source="yahoo",
            matched_crop_names=["芒果"],
        )
        for index in range(12)
    ]
    monkeypatch.setattr(news, "fetch_yahoo_news_list", lambda keywords, *, limit: candidates)
    monkeypatch.setattr(
        news,
        "fetch_yahoo_article_content",
        lambda url: news._article_from_content(
            source_name="Yahoo新聞",
            source_url=url,
            source_article_id=None,
            title="",
            published_date="2026-07-15",
            content_text="芒果農民採收，芒果產地供應穩定。",
            crawl_source="yahoo",
        ),
    )

    items = news.fetch_relevant_yahoo_articles(["芒果"])

    assert len(items) == news.YAHOO_FINAL_LIMIT


def test_fetch_relevant_yahoo_articles_sorts_by_score_before_date(monkeypatch):
    old_high = news._empty_article(
        source_name="自由時報",
        title="高麗菜產地採收受寒害",
        published_date="2026-07-14",
        source_url="https://tw.news.yahoo.com/high-111.html",
        crawl_source="yahoo",
        matched_crop_names=["高麗菜"],
    )
    new_low = news._empty_article(
        source_name="自由時報",
        title="高麗菜批發價走弱",
        published_date="2026-07-15",
        source_url="https://tw.news.yahoo.com/low-222.html",
        crawl_source="yahoo",
        matched_crop_names=["高麗菜"],
    )
    monkeypatch.setattr(news, "fetch_yahoo_news_list", lambda keywords, *, limit: [new_low, old_high])
    monkeypatch.setattr(
        news,
        "fetch_yahoo_article_content",
        lambda url: news._article_from_content(
            source_name="Yahoo新聞",
            source_url=url,
            source_article_id=None,
            title="",
            published_date=None,
            content_text="高麗菜產地農民採收。" if "high" in url else "高麗菜批發價下跌。",
            crawl_source="yahoo",
        ),
    )

    items = news.fetch_relevant_yahoo_articles(["高麗菜"])

    assert [item["title"] for item in items] == ["高麗菜產地採收受寒害", "高麗菜批發價走弱"]
    assert items[0]["relevance_score"] > items[1]["relevance_score"]


def test_fetch_relevant_yahoo_articles_checks_candidates_beyond_first_ten(monkeypatch):
    candidates = [
        news._empty_article(
            source_name="自由時報",
            title=f"芒果餐廳優惠 {index}",
            source_url=f"https://tw.news.yahoo.com/food-{index}-123{index}.html",
            crawl_source="yahoo",
            matched_crop_names=["芒果"],
        )
        for index in range(10)
    ] + [
        news._empty_article(
            source_name="自由時報",
            title="芒果產地採收增加",
            source_url="https://tw.news.yahoo.com/agri-999.html",
            crawl_source="yahoo",
            matched_crop_names=["芒果"],
        )
    ]

    def fake_fetch_detail(url):
        if "agri" in url:
            content = "芒果農民採收，芒果產地供應穩定。"
        else:
            content = "餐廳甜點優惠，芒果蛋糕限時折扣。"
        return news._article_from_content(
            source_name="Yahoo新聞",
            source_url=url,
            source_article_id=None,
            title="",
            published_date="2026-07-15",
            content_text=content,
            crawl_source="yahoo",
        )

    monkeypatch.setattr(news, "fetch_yahoo_news_list", lambda keywords, *, limit: candidates)
    monkeypatch.setattr(news, "fetch_yahoo_article_content", fake_fetch_detail)

    items = news.fetch_relevant_yahoo_articles(["芒果"])

    assert len(items) == 1
    assert items[0]["title"] == "芒果產地採收增加"


def test_fetch_relevant_yahoo_articles_records_relevance_stats(monkeypatch):
    accepted = news._empty_article(
        source_name="自由時報",
        title="芒果產地採收增加",
        source_url="https://tw.news.yahoo.com/agri-101.html",
        crawl_source="yahoo",
        matched_crop_names=["芒果"],
    )
    rejected = news._empty_article(
        source_name="科技網",
        title="蘋果公司供應鏈庫存回升，產品價格調整",
        source_url="https://tw.news.yahoo.com/tech-202.html",
        crawl_source="yahoo",
        matched_crop_names=["蘋果"],
    )
    monkeypatch.setattr(news, "fetch_yahoo_news_list", lambda keywords, *, limit: [accepted, rejected])
    monkeypatch.setattr(
        news,
        "fetch_yahoo_article_content",
        lambda url: news._article_from_content(
            source_name="Yahoo新聞",
            source_url=url,
            source_article_id=None,
            title="",
            published_date="2026-07-15",
            content_text="芒果農民採收，芒果產地供應穩定。" if "agri" in url else "手機財報消息。",
            crawl_source="yahoo",
        ),
    )

    items = news.fetch_relevant_yahoo_articles(["芒果", "蘋果"])
    stats = news.get_last_yahoo_relevance_stats()

    assert len(items) == 1
    assert stats.candidate_count == 2
    assert stats.accepted_count == 1
    assert stats.rejected_count == 1
    assert stats.rejection_reasons == {"ambiguous_crop_negative_title": 1}


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


def test_standard_article_shape_does_not_include_yahoo_internal_fields():
    article = news._empty_article(
        source_name="農業部",
        title="農業部測試新聞",
        source_url="https://example.test/news/1",
    )

    assert set(article) == {
        "article_key",
        "source_name",
        "source_article_id",
        "title",
        "published_date",
        "source_url",
        "content_text",
        "content_hash",
        "parse_status",
        "parse_error",
    }


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
    monkeypatch.setattr(news, "fetch_ptt_fruits_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_agriharvest_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_threads_posts", lambda limit: [])
    monkeypatch.setattr(news, "fetch_yahoo_news_list", lambda keywords, *, limit: [])
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

    items = news.fetch_agri_news(limit_per_source=1, yahoo_keywords=["芒果"])

    assert len(items) == 2
    assert items[0]["title"] == "農業部測試新聞"
    assert items[0]["parse_status"] == "failed"
    assert items[0]["parse_error"] == "boom"
    assert items[1]["source_name"] == "農糧署"
    assert items[1]["parse_status"] == "success"


def test_fetch_agri_news_raises_when_both_lists_empty(monkeypatch):
    monkeypatch.setattr(news, "fetch_moa_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_afa_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_ptt_fruits_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_agriharvest_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_threads_posts", lambda limit: [])
    monkeypatch.setattr(news, "fetch_yahoo_news_list", lambda keywords, *, limit: [])

    with pytest.raises(RuntimeError, match="Unable to fetch any agriculture news list data"):
        news.fetch_agri_news(limit_per_source=1, yahoo_keywords=["芒果"])


def test_fetch_agri_news_yahoo_returns_at_most_ten_relevant_articles(monkeypatch):
    yahoo_items = [
        news._empty_article(
            source_name="自由時報",
            title=f"新聞 {index}",
            source_url=f"https://tw.news.yahoo.com/article-{index}-123{index}.html",
            crawl_source="yahoo",
            matched_crop_names=["芒果"],
        )
        for index in range(12)
    ]
    fetched_urls = []

    monkeypatch.setattr(news, "fetch_moa_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_afa_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_ptt_fruits_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_agriharvest_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_threads_posts", lambda limit: [])
    monkeypatch.setattr(news, "fetch_yahoo_news_list", lambda keywords, *, limit: yahoo_items[:limit])

    def fake_fetch_detail(url):
        fetched_urls.append(url)
        return news._article_from_content(
            source_name="Yahoo新聞",
            source_url=url,
            source_article_id=None,
            title="",
            published_date="2026-07-15",
            content_text="芒果農民採收，芒果產地供應穩定。",
            crawl_source="yahoo",
        )

    monkeypatch.setattr(news, "fetch_yahoo_article_content", fake_fetch_detail)

    items = news.fetch_agri_news(limit_per_source=50, yahoo_keywords=["芒果"])

    assert len(items) == 10
    assert len(fetched_urls) == 12


def test_fetch_agri_news_excludes_yahoo_articles_rejected_by_relevance(monkeypatch):
    moa_base = news._empty_article(
        source_name="農業部",
        source_article_id="10036",
        title="農業部測試新聞",
        published_date="2026-07-12",
        source_url="https://www.moa.gov.tw/theme_data.php?theme=news&sub_theme=agri&id=10209",
    )
    yahoo_candidate = news._empty_article(
        source_name="自由時報",
        title="高麗菜絲免費加，豬排定食限時 199 元",
        source_url="https://tw.news.yahoo.com/food-199.html",
        crawl_source="yahoo",
        matched_crop_names=["高麗菜"],
    )
    monkeypatch.setattr(news, "fetch_moa_news_list", lambda limit: [moa_base])
    monkeypatch.setattr(news, "fetch_afa_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_ptt_fruits_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_agriharvest_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_threads_posts", lambda limit: [])
    monkeypatch.setattr(news, "fetch_yahoo_news_list", lambda keywords, *, limit: [yahoo_candidate])
    monkeypatch.setattr(
        news,
        "fetch_moa_article_content",
        lambda url: {
            **moa_base,
            "content_text": "農業部正文",
            "content_hash": news._content_hash("農業部正文"),
            "parse_status": "success",
            "parse_error": None,
        },
    )
    monkeypatch.setattr(
        news,
        "fetch_yahoo_article_content",
        lambda url: news._article_from_content(
            source_name="Yahoo新聞",
            source_url=url,
            source_article_id=None,
            title="",
            published_date="2026-07-15",
            content_text="餐廳活動，高麗菜絲免費加。",
            crawl_source="yahoo",
        ),
    )

    items = news.fetch_agri_news(limit_per_source=10, yahoo_keywords=["高麗菜"])

    assert len(items) == 1
    assert items[0]["source_name"] == "農業部"
    assert all(item.get("crawl_source") != "yahoo" for item in items)


def test_fetch_agri_news_includes_threads_and_limits_it_to_ten(monkeypatch):
    threads_articles = [
        {
            **news._empty_article(
                source_name="農民日常（Threads）",
                source_article_id=f"thread-{index}",
                title="Threads 測試貼文",
                source_url=f"https://www.threads.net/t/thread-{index}",
                crawl_source="threads",
            ),
            "content_text": "正文",
            "content_hash": news._content_hash("正文"),
            "parse_status": "success",
        }
        for index in range(10)
    ]
    monkeypatch.setattr(news, "fetch_moa_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_afa_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_ptt_fruits_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_agriharvest_news_list", lambda limit: [])
    monkeypatch.setattr(news, "fetch_yahoo_news_list", lambda keywords, *, limit: [])
    captured = {}

    def fake_threads(limit):
        captured["limit"] = limit
        return threads_articles

    monkeypatch.setattr(news, "fetch_threads_posts", fake_threads)

    items = news.fetch_agri_news(limit_per_source=50, yahoo_keywords=[])

    assert captured["limit"] == 10
    assert items == threads_articles
