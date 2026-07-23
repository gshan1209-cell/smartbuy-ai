import asyncio
import json
import time

from backend.routers import agriculture


def _reset_cache():
    agriculture._cache.update(
        {
            "county_index": {},
            "loaded_at": 0.0,
            "fetching": False,
            "data_source": None,
            "dataset_path": None,
            "dataset_year": None,
        }
    )
    agriculture._refresh_task = None
    agriculture._scheduler_task = None


def test_snapshot_survives_process_cache_reset(tmp_path, monkeypatch):
    cache_path = tmp_path / "agriculture.json"
    monkeypatch.setattr(agriculture, "_CACHE_PATH", cache_path)
    _reset_cache()

    county_index = {"宜蘭縣": [{"縣市": "宜蘭縣", "作物": "青蔥"}]}
    loaded_at = time.time()
    agriculture._write_snapshot(county_index, loaded_at)

    _reset_cache()
    assert agriculture._read_snapshot() is True
    assert agriculture._cache["county_index"] == county_index
    assert agriculture._cache["loaded_at"] == loaded_at


def test_fetch_builds_index_and_persists_snapshot(tmp_path, monkeypatch):
    cache_path = tmp_path / "agriculture.json"
    monkeypatch.setattr(agriculture, "_CACHE_PATH", cache_path)
    _reset_cache()

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return [
                {"縣市": "宜蘭縣", "作物": "青蔥"},
                {"縣市": "臺南市", "作物": "芒果"},
            ]

    monkeypatch.setattr(agriculture.requests, "get", lambda *args, **kwargs: Response())

    assert agriculture._fetch_and_rebuild() is True
    assert set(agriculture._cache["county_index"]) == {"宜蘭縣", "臺南市"}
    snapshot = json.loads(cache_path.read_text(encoding="utf-8"))
    assert snapshot["schema_version"] == 3
    assert snapshot["county_index"]["宜蘭縣"][0]["name"] == "青蔥"


def test_downloaded_dataset_is_loaded_before_snapshot(tmp_path, monkeypatch):
    downloaded_path = tmp_path / "town_crop_114_complete.json"
    downloaded_path.write_text(
        json.dumps(
            [
                {
                    "年度": "114",
                    "期作": "全年",
                    "縣市": "宜蘭縣",
                    "鄉鎮": "三星鄉",
                    "作物": "青蔥",
                    "種植面積(公頃)": 12,
                },
                {
                    "年度": "114",
                    "期作": "全年",
                    "縣市": "臺南市",
                    "鄉鎮": "玉井區",
                    "作物": "芒果",
                    "種植面積(公頃)": 20,
                },
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(agriculture, "_DOWNLOADED_DATA_PATH", str(downloaded_path))
    monkeypatch.setattr(
        agriculture,
        "_read_snapshot",
        lambda: (_ for _ in ()).throw(AssertionError("snapshot should not be read")),
    )
    _reset_cache()

    assert agriculture._load_preferred_data() is True
    assert agriculture._cache["data_source"] == "downloaded"
    assert agriculture._cache["dataset_path"] == str(downloaded_path)
    assert agriculture._cache["dataset_year"] == "114"
    assert set(agriculture._cache["county_index"]) == {"宜蘭縣", "臺南市"}
    assert agriculture._cache["county_index"]["宜蘭縣"][0]["name"] == "青蔥"


def test_latest_downloaded_dataset_is_selected(tmp_path, monkeypatch):
    older = tmp_path / "town_crop_113_complete.json"
    latest = tmp_path / "town_crop_114_complete.json"
    older.write_text("[]", encoding="utf-8")
    latest.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(agriculture, "_DOWNLOADED_DATA_PATH", None)
    monkeypatch.setattr(agriculture, "_DOWNLOADED_DATA_DIR", tmp_path)

    assert agriculture._find_downloaded_dataset() == latest


def test_fetch_uses_year_filter_and_paginates_complete_result(tmp_path, monkeypatch):
    cache_path = tmp_path / "agriculture.json"
    monkeypatch.setattr(agriculture, "_CACHE_PATH", cache_path)
    monkeypatch.setattr(agriculture, "_PAGE_SIZE", 2)
    monkeypatch.setattr(agriculture, "_latest_candidate_years", lambda: ["114"])
    _reset_cache()
    calls = []

    class Response:
        def __init__(self, rows):
            self._rows = rows

        def raise_for_status(self):
            return None

        def json(self):
            return self._rows

    pages = {
        0: [
            {
                "年度": "114",
                "縣市": "宜蘭縣",
                "鄉鎮": "三星鄉",
                "作物": "青蔥",
                "種植面積(公頃)": 1,
            },
            {
                "年度": "114",
                "縣市": "宜蘭縣",
                "鄉鎮": "壯圍鄉",
                "作物": "青蔥",
                "種植面積(公頃)": 2,
            },
        ],
        2: [
            {
                "年度": "114",
                "縣市": "臺南市",
                "鄉鎮": "玉井區",
                "作物": "芒果",
                "種植面積(公頃)": 5,
            }
        ],
    }

    def fake_get(_url, *, params, timeout):
        calls.append((params.copy(), timeout))
        return Response(pages[params["$skip"]])

    monkeypatch.setattr(agriculture.requests, "get", fake_get)

    assert agriculture._fetch_and_rebuild() is True
    assert [params["$skip"] for params, _ in calls] == [0, 2]
    assert all(params["year"] == "114" for params, _ in calls)
    assert agriculture._cache["county_index"]["宜蘭縣"] == [
        {
            "name": "青蔥",
            "county": "宜蘭縣",
            "township": "壯圍鄉",
            "year": "114",
            "plantingArea": 3.0,
            "harvestArea": None,
            "yield": None,
        }
    ]


def test_build_index_keeps_latest_year_aggregates_and_ranks_crops():
    rows = [
        {
            "年度": "113",
            "縣市": "宜蘭縣",
            "鄉鎮": "三星鄉",
            "作物": "青蔥",
            "種植面積(公頃)": 100,
        },
        {
            "年度": "114",
            "期作": "全年",
            "縣市": "宜蘭縣",
            "鄉鎮": "三星鄉",
            "作物": "青蔥",
            "種植面積(公頃)": 5,
            "收量(公斤)": 50,
        },
        {
            "年度": "114",
            "期作": "一期作",
            "縣市": "宜蘭縣",
            "鄉鎮": "三星鄉",
            "作物": "青蔥",
            "種植面積(公頃)": 99,
            "收量(公斤)": 990,
        },
        {
            "年度": "114",
            "期作": "全年",
            "縣市": "宜蘭縣",
            "鄉鎮": "員山鄉",
            "作物": "文旦",
            "種植面積(公頃)": 8,
            "收量(公斤)": 80,
        },
        {
            "年度": "114",
            "期作": "全年",
            "縣市": "宜蘭縣",
            "鄉鎮": "員山鄉",
            "作物": "休閒面積",
            "種植面積(公頃)": 9999,
        },
    ]

    items = agriculture._build_index(rows)["宜蘭縣"]

    assert [item["name"] for item in items] == ["文旦", "青蔥"]
    assert items[1]["year"] == "114"
    assert items[1]["plantingArea"] == 5.0
    assert items[1]["yield"] == 50.0


def test_concurrent_refreshes_share_one_official_api_call(monkeypatch):
    _reset_cache()
    calls = 0

    def fake_fetch():
        nonlocal calls
        calls += 1
        time.sleep(0.05)
        agriculture._cache["county_index"] = {"宜蘭縣": []}
        agriculture._cache["loaded_at"] = time.time()
        return True

    monkeypatch.setattr(agriculture, "_fetch_and_rebuild", fake_fetch)

    async def exercise():
        first = agriculture._start_refresh()
        second = agriculture._start_refresh()
        assert first is second
        await asyncio.gather(first, second)

    asyncio.run(exercise())
    assert calls == 1
