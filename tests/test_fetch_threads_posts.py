import json

from src.data import fetch_threads_posts as threads


USERNAME = "abc89151207"


def make_post(code, taken_at, text, *, username=USERNAME, post_id=None, snippet=None):
    post = {
        "id": post_id or f"id-{code}",
        "code": code,
        "user": {"username": username},
        "caption": {"text": text},
        "taken_at": taken_at,
    }
    if snippet is not None:
        post["text_post_app_info"] = {
            "snippet_attachment_info": {
                "text_fragments": {"fragments": [{"plaintext": snippet}]}
            }
        }
    return post


def payload_with_items(*posts):
    return {"data": {"edges": [{"node": {"thread_items": [{"post": post} for post in posts]}}]}}


def json_script(payload):
    return f'<script type="application/json">{json.dumps(payload)}</script>'


def test_extract_application_json_blocks_skips_invalid_json():
    html = json_script({"ok": True}) + '<script type="application/json">{bad}</script>'

    assert threads.extract_application_json_blocks(html) == [{"ok": True}]


def test_profile_url_keeps_default_and_allows_username_override():
    assert threads._profile_url(USERNAME) == threads.THREADS_PROFILE_URL
    assert threads._profile_url("another_account") == "https://www.threads.net/@another_account?hl=zh-tw"


def test_profile_summaries_filter_sort_dedupe_and_limit():
    payloads = [
        payload_with_items(make_post("old", 10, "old")),
        payload_with_items(make_post("new", 30, "new")),
        payload_with_items(make_post("new", 20, "duplicate")),
        payload_with_items(make_post("other", 40, "not ours", username="someone_else")),
        payload_with_items(make_post("middle", 20, "middle")),
    ]

    summaries = threads.extract_profile_thread_summaries(payloads, username=USERNAME, limit=2)

    assert [summary["code"] for summary in summaries] == ["new", "middle"]
    assert all(summary["username"] == USERNAME for summary in summaries)


def test_author_thread_posts_excludes_other_users_sorts_and_uses_longer_snippet():
    root = make_post("root", 20, "短文", snippet="主貼文較完整內容")
    reply = make_post("reply", 30, "續串內容", post_id="reply-id")
    duplicate_reply = make_post("reply", 31, "重複續串", post_id="reply-id")
    other = make_post("comment", 25, "其他使用者留言", username="commenter")

    posts = threads.extract_author_thread_posts(
        [payload_with_items(reply, other, root, duplicate_reply)],
        username=USERNAME,
        root_code="root",
    )

    assert [post["code"] for post in posts] == ["root", "reply"]
    assert [post["text"] for post in posts] == ["主貼文較完整內容", "續串內容"]
    assert "其他使用者留言" not in "\n".join(post["text"] for post in posts)


def test_threads_article_uses_canonical_fields_title_and_taipei_date():
    root = {
        "code": "root-code",
        "taken_at": 1784593800,  # 2026-07-20 16:30 UTC, next day in Taipei.
        "text": "🔊  芒果產地行情\n\n第一段",
    }
    article = threads.thread_article_from_posts(
        root,
        [
            {"id": "1", "code": "root-code", "taken_at": 1784593800, "text": root["text"]},
            {"id": "2", "code": "continued", "taken_at": 1784593810, "text": "續串內容"},
            {"id": "3", "code": "duplicate", "taken_at": 1784593820, "text": "續串內容"},
        ],
    )

    assert article["source_name"] == "農民日常（Threads）"
    assert article["source_article_id"] == "root-code"
    assert article["published_date"] == "2026-07-21"
    assert article["title"] == "芒果產地行情"
    assert article["source_url"] == "https://www.threads.net/t/root-code"
    assert article["article_key"] == threads._article_key(article["source_url"])
    assert article["content_text"] == "🔊 芒果產地行情\n第一段\n\n續串內容"
    assert article["parse_status"] == "success"
    assert article["crawl_source"] == "threads"


def test_detail_failure_is_partial_and_empty_detail_is_failed():
    root = {"code": "root", "taken_at": 1, "text": "主貼文"}

    partial = threads.thread_article_from_posts(
        root, [], detail_error="timeout", detail_parsed=False
    )
    failed = threads.thread_article_from_posts({**root, "text": ""}, [], detail_parsed=True)

    assert partial["parse_status"] == "partial"
    assert partial["content_text"] == "主貼文"
    assert failed["parse_status"] == "failed"
    assert failed["content_text"] is None


class FakeResponse:
    status = 200


class FakePage:
    def __init__(self, html_by_url):
        self.html_by_url = html_by_url
        self.url = ""

    def set_default_timeout(self, _timeout):
        pass

    def goto(self, url, **_kwargs):
        self.url = url
        return FakeResponse()

    def title(self):
        return "農民日常 (@abc89151207) - Threads"

    def wait_for_timeout(self, _timeout):
        pass

    def content(self):
        return self.html_by_url[self.url]


class FakeBrowser:
    def __init__(self, html_by_url):
        self.html_by_url = html_by_url
        self.closed = False

    def new_context(self, **_kwargs):
        return self

    def new_page(self):
        return FakePage(self.html_by_url)

    def close(self):
        self.closed = True


class FakePlaywrightManager:
    def __init__(self, browser):
        self.browser = browser
        self.chromium = self

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def launch(self, **_kwargs):
        return self.browser


def test_fetch_threads_posts_closes_one_browser_and_preserves_detail_failure(monkeypatch):
    root = make_post("root", 10, "主貼文")
    profile_url = threads.THREADS_PROFILE_URL
    detail_url = "https://www.threads.net/t/root?hl=zh-tw"
    browser = FakeBrowser(
        {
            profile_url: json_script(payload_with_items(root)),
            detail_url: json_script(payload_with_items(root, make_post("reply", 11, "續串"))),
        }
    )
    monkeypatch.setattr(threads, "_sync_playwright", lambda: lambda: FakePlaywrightManager(browser))

    articles = threads.fetch_threads_posts(limit=10)

    assert browser.closed is True
    assert len(articles) == 1
    assert articles[0]["content_text"] == "主貼文\n\n續串"
