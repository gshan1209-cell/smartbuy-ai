"""
SmartBuy AI — 縣市農產 Router

優化重點：
1. 啟動時優先載入已下載完整資料，其次才是磁碟快照與官方 API
2. 只抓最新年度並使用 top/skip 分頁，避免官方 API 的一萬筆上限
3. 預先按縣市、作物聚合並排序，查詢 O(1)
4. 快取過期或官方 API 暫時失敗時，先回傳 stale 資料
5. 冷啟動最多短暫等待，刷新工作繼續在背景執行
"""
from __future__ import annotations

import asyncio
import datetime
import json
import logging
import os
import time
from contextlib import suppress
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

import requests
from fastapi import APIRouter, HTTPException, Query, Response

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/api/agriculture', tags=['agriculture'])

SOURCE_URL = (
    'https://data.moa.gov.tw/Service/OpenData/FromM/TownCropData.aspx'
    '?IsTransData=1&UnitId=038'
)

_NON_MARKET_CROP_NAMES = {
    '休閒面積',
    '荒廢面積',
    '耕地造林',
}

_SNAPSHOT_SCHEMA_VERSION = 3
_CACHE_TTL_SECONDS = int(os.getenv('AGRICULTURE_CACHE_TTL_SECONDS', 7 * 24 * 3600))
_FETCH_TIMEOUT = int(os.getenv('AGRICULTURE_FETCH_TIMEOUT_SECONDS', 25))
_PAGE_SIZE = min(1000, max(100, int(os.getenv('AGRICULTURE_PAGE_SIZE', 1000))))
_MAX_PAGES_PER_YEAR = int(os.getenv('AGRICULTURE_MAX_PAGES_PER_YEAR', 100))
_LATEST_YEAR_LOOKBACK = int(os.getenv('AGRICULTURE_YEAR_LOOKBACK', 5))
_COLD_WAIT_SECONDS = float(os.getenv('AGRICULTURE_COLD_WAIT_SECONDS', 2.5))
_CACHE_PATH = Path(
    os.getenv(
        'AGRICULTURE_CACHE_PATH',
        Path(__file__).resolve().parents[1] / '.cache' / 'agriculture_county_index.json',
    )
)
_DOWNLOADED_DATA_PATH = os.getenv('AGRICULTURE_DOWNLOADED_DATA_PATH')
_DOWNLOADED_DATA_DIR = (
    Path(__file__).resolve().parents[2] / 'data' / 'raw' / 'agriculture'
)

# ── 快取狀態 ────────────────────────────────────────────────
_cache: dict[str, Any] = {
    'county_index': {},   # { '宜蘭縣': [...rows], ... }
    'loaded_at': 0.0,     # Unix timestamp，0 表示尚未載入
    'fetching': False,    # 是否正在背景取資料
    'data_source': None,  # downloaded / snapshot / official_api
    'dataset_path': None,
    'dataset_year': None,
}
_refresh_task: asyncio.Task | None = None
_scheduler_task: asyncio.Task | None = None


def _is_stale() -> bool:
    return (
        not _cache['county_index']
        or (time.time() - _cache['loaded_at']) > _CACHE_TTL_SECONDS
    )


def _value(row: dict, *keys: str):
    for key in keys:
        if row.get(key) not in (None, ''):
            return row[key]
    return None


def _number(value: Any) -> float | None:
    if value in (None, ''):
        return None
    try:
        return float(str(value).replace(',', '').strip())
    except (TypeError, ValueError):
        return None


def _rounded_sum(values: list[Any]) -> float | None:
    numbers = [number for value in values if (number := _number(value)) is not None]
    return round(sum(numbers), 2) if numbers else None


def _latest_candidate_years() -> list[str]:
    current_roc_year = datetime.date.today().year - 1911
    candidates = []
    if _cache.get('dataset_year'):
        candidates.append(str(_cache['dataset_year']))
    # 年度資料通常於次年發布，先查前一年度可避免對尚未存在的年度等待逾時。
    candidates.extend(
        str(current_roc_year - offset)
        for offset in range(1, _LATEST_YEAR_LOOKBACK + 2)
    )
    return list(dict.fromkeys(candidates))


def _extract_rows(payload: Any) -> list[dict]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        rows = payload.get('data', payload.get('result', []))
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, dict)]
    raise ValueError('農業部回傳格式不是資料列表')


def _fetch_latest_rows() -> tuple[list[dict], str]:
    """以年度條件和 top/skip 分頁，只下載最新一個有資料的年度。"""
    for year in _latest_candidate_years():
        rows: list[dict] = []
        for page_number in range(_MAX_PAGES_PER_YEAR):
            skip = page_number * _PAGE_SIZE
            response = requests.get(
                SOURCE_URL,
                params={'$top': _PAGE_SIZE, '$skip': skip, 'year': year},
                timeout=_FETCH_TIMEOUT,
            )
            response.raise_for_status()
            page_rows = _extract_rows(response.json())
            rows.extend(page_rows)
            if len(page_rows) < _PAGE_SIZE:
                break
        else:
            raise RuntimeError(
                f'農情調查 {year} 年資料超過安全分頁上限 '
                f'{_MAX_PAGES_PER_YEAR * _PAGE_SIZE} 筆'
            )

        if rows:
            logger.info(
                '[agriculture] 已取得民國 %s 年資料，共 %d 筆、%d 頁。',
                year,
                len(rows),
                (len(rows) + _PAGE_SIZE - 1) // _PAGE_SIZE,
            )
            return rows, year

    raise ValueError('近年農情調查沒有可用資料')


def _build_index(rows: list[dict]) -> dict[str, list[dict]]:
    """把最新年度資料按縣市、作物聚合成可直接回傳的精簡索引。"""
    by_county: dict[str, list[dict]] = {}
    for row in rows:
        county = str(_value(row, '縣市', 'county', 'COUNTYNAME') or '').strip()
        if county:
            by_county.setdefault(county, []).append(row)

    index: dict[str, list[dict]] = {}
    for county, county_rows in by_county.items():
        years = [
            str(value).strip()
            for row in county_rows
            if (value := _value(row, '年度', 'year', 'YEAR')) not in (None, '')
        ]
        latest_year = max(years, key=lambda value: int(value) if value.isdigit() else -1) if years else None
        if latest_year is not None:
            county_rows = [
                row
                for row in county_rows
                if str(_value(row, '年度', 'year', 'YEAR') or '').strip() == latest_year
            ]

        grouped: dict[str, list[dict]] = {}
        for row in county_rows:
            crop = str(_value(row, '作物', 'crop', 'CROP', 'name') or '').strip()
            if crop and crop not in _NON_MARKET_CROP_NAMES and not crop.endswith('面積'):
                grouped.setdefault(crop, []).append(row)

        items: list[dict] = []
        for crop, crop_rows in grouped.items():
            annual_rows = [
                row
                for row in crop_rows
                if str(_value(row, '期作', 'season', 'SEASON') or '').strip() == '全年'
            ]
            rows_to_sum = annual_rows or crop_rows
            top_row = max(
                rows_to_sum,
                key=lambda row: _number(
                    _value(row, '種植面積(公頃)', '種植面積', 'planting_area', 'plantingArea')
                ) or 0,
            )
            items.append(
                {
                    'name': crop,
                    'county': county,
                    'township': _value(top_row, '鄉鎮', 'township', 'TOWN'),
                    'year': latest_year or _value(top_row, '年度', 'year', 'YEAR'),
                    'plantingArea': _rounded_sum([
                        _value(
                            row,
                            '種植面積(公頃)',
                            '種植面積',
                            'planting_area',
                            'plantingArea',
                        )
                        for row in rows_to_sum
                    ]),
                    'harvestArea': _rounded_sum([
                        _value(
                            row,
                            '收穫面積(公頃)',
                            '收穫面積',
                            'harvest_area',
                            'harvestArea',
                        )
                        for row in rows_to_sum
                    ]),
                    'yield': _rounded_sum([
                        _value(row, '收量(公斤)', '收量', 'yield')
                        for row in rows_to_sum
                    ]),
                }
            )

        items.sort(
            key=lambda item: (
                item['plantingArea'] or 0,
                item['yield'] or 0,
                item['name'],
            ),
            reverse=True,
        )
        if items:
            index[county] = items
    return index


def _dataset_year_from_index(county_index: dict[str, list[dict]]) -> str | None:
    for rows in county_index.values():
        if not rows:
            continue
        year = _value(rows[0], 'year', '年度', 'YEAR')
        if year not in (None, ''):
            return str(year)
    return None


def _downloaded_dataset_sort_key(path: Path) -> tuple[int, float]:
    parts = path.stem.split('_')
    try:
        year = int(parts[2])
    except (IndexError, ValueError):
        year = -1
    return year, path.stat().st_mtime


def _find_downloaded_dataset() -> Path | None:
    """尋找指定檔案，否則選擇 data/raw 中年度最新的完整資料包。"""
    if _DOWNLOADED_DATA_PATH:
        configured_path = Path(_DOWNLOADED_DATA_PATH)
        return configured_path if configured_path.is_file() else None

    if not _DOWNLOADED_DATA_DIR.is_dir():
        return None
    candidates = list(_DOWNLOADED_DATA_DIR.glob('town_crop_*_complete.json'))
    return max(candidates, key=_downloaded_dataset_sort_key) if candidates else None


def _read_downloaded_dataset() -> bool:
    """讀取已下載完整資料包，建立精簡索引；這是系統的第一優先來源。"""
    dataset_path = _find_downloaded_dataset()
    if dataset_path is None:
        return False

    try:
        rows = _extract_rows(json.loads(dataset_path.read_text(encoding='utf-8')))
        county_index = _build_index(rows)
        if not county_index:
            raise ValueError('下載資料無有效縣市')
        _cache['county_index'] = county_index
        # 每次程序啟動成功讀取即視為可用，七天後才在背景向官方來源更新。
        _cache['loaded_at'] = time.time()
        _cache['data_source'] = 'downloaded'
        _cache['dataset_path'] = str(dataset_path)
        _cache['dataset_year'] = _dataset_year_from_index(county_index)
        logger.info(
            '[agriculture] 已優先載入下載資料 %s，共 %d 筆、%d 縣市。',
            dataset_path.name,
            len(rows),
            len(county_index),
        )
        return True
    except Exception:
        logger.exception('[agriculture] 無法讀取下載資料，改用磁碟快照。')
        return False


def _read_snapshot() -> bool:
    """載入上次成功資料，讓程序重啟後仍可立即提供 stale-while-revalidate。"""
    if not _CACHE_PATH.exists():
        return False

    try:
        snapshot = json.loads(_CACHE_PATH.read_text(encoding='utf-8'))
        county_index = snapshot.get('county_index')
        if not isinstance(county_index, dict) or not county_index:
            raise ValueError('county_index is empty or invalid')
        _cache['county_index'] = county_index
        schema_version = int(snapshot.get('schema_version') or 1)
        _cache['loaded_at'] = (
            float(snapshot.get('loaded_at') or 0)
            if schema_version >= _SNAPSHOT_SCHEMA_VERSION
            else 0.0
        )
        _cache['data_source'] = 'snapshot'
        _cache['dataset_path'] = str(_CACHE_PATH)
        _cache['dataset_year'] = (
            str(snapshot['dataset_year'])
            if snapshot.get('dataset_year') not in (None, '')
            else _dataset_year_from_index(county_index)
        )
        logger.info(
            '[agriculture] 已載入磁碟快照 v%d，共 %d 縣市%s。',
            schema_version,
            len(county_index),
            '（已過期，將背景更新）' if _is_stale() else '',
        )
        return True
    except Exception:
        logger.exception('[agriculture] 無法讀取磁碟快照，將重新取得官方資料。')
        return False


def _load_preferred_data() -> bool:
    """載入順序固定為：下載完整資料 → 上次成功快照。"""
    return _read_downloaded_dataset() or _read_snapshot()


def _write_snapshot(county_index: dict[str, list[dict]], loaded_at: float) -> None:
    """以原子替換寫入快照，避免程序中止留下半份 JSON。"""
    _CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp_path: Path | None = None
    try:
        with NamedTemporaryFile(
            mode='w',
            encoding='utf-8',
            dir=_CACHE_PATH.parent,
            prefix=f'{_CACHE_PATH.name}.',
            suffix='.tmp',
            delete=False,
        ) as temp_file:
            json.dump(
                {
                    'schema_version': _SNAPSHOT_SCHEMA_VERSION,
                    'loaded_at': loaded_at,
                    'dataset_year': _dataset_year_from_index(county_index),
                    'county_index': county_index,
                },
                temp_file,
                ensure_ascii=False,
                separators=(',', ':'),
            )
            temp_path = Path(temp_file.name)
        temp_path.replace(_CACHE_PATH)
    finally:
        if temp_path is not None and temp_path.exists():
            with suppress(OSError):
                temp_path.unlink()


def _fetch_and_rebuild() -> bool:
    """同步抓取、建索引並保存快照（由工作執行緒呼叫）。"""
    logger.info('[agriculture] 開始向農業部取得農情調查資料…')
    try:
        rows, year = _fetch_latest_rows()
        county_index = _build_index(rows)
        if not county_index:
            raise ValueError('農業部回傳資料無有效縣市')
        loaded_at = time.time()
        _write_snapshot(county_index, loaded_at)
        _cache['county_index'] = county_index
        _cache['loaded_at'] = loaded_at
        _cache['data_source'] = 'official_api'
        _cache['dataset_path'] = None
        _cache['dataset_year'] = year
        logger.info(
            '[agriculture] 民國 %s 年農情調查快取更新完成，共 %d 縣市。',
            year,
            len(_cache['county_index']),
        )
        return True
    except Exception:
        logger.exception('[agriculture] 農情調查資料取得失敗，保留舊快取。')
        return False


async def _run_refresh() -> bool:
    global _refresh_task
    try:
        return await asyncio.to_thread(_fetch_and_rebuild)
    finally:
        _cache['fetching'] = False
        _refresh_task = None


def _start_refresh() -> asyncio.Task:
    """共用同一個刷新工作，避免多個請求同時呼叫官方 API。"""
    global _refresh_task
    if _refresh_task is None or _refresh_task.done():
        _cache['fetching'] = True
        _refresh_task = asyncio.create_task(_run_refresh())
    return _refresh_task


async def _refresh_periodically() -> None:
    while True:
        await asyncio.sleep(max(1, min(_CACHE_TTL_SECONDS, 5 * 60)))
        if _is_stale():
            await _start_refresh()


async def preload() -> None:
    """由 lifespan 呼叫；下載資料優先，外部 API 一律只在背景更新。"""
    global _scheduler_task
    await asyncio.to_thread(_load_preferred_data)
    if _is_stale():
        _start_refresh()
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = asyncio.create_task(_refresh_periodically())


async def shutdown() -> None:
    """停止 lifespan 建立的背景工作。"""
    global _refresh_task, _scheduler_task
    tasks = [task for task in (_refresh_task, _scheduler_task) if task is not None]
    for task in tasks:
        task.cancel()
    for task in tasks:
        with suppress(asyncio.CancelledError):
            await task
    _refresh_task = None
    _scheduler_task = None
    _cache['fetching'] = False


def _format_items(rows: list[dict], county: str, limit: int) -> tuple[list[dict], Any]:
    if rows and 'name' in rows[0]:
        items = [
            {**row, 'source': SOURCE_URL}
            for row in rows[:limit]
        ]
        return items, items[0].get('year') if items else None

    # 相容 v1 磁碟快照；新版背景更新完成後會改用上方精簡格式。
    latest_year = max(
        (_value(row, '年度', 'year', 'YEAR') for row in rows),
        default=None,
    )
    if latest_year is not None:
        rows = [row for row in rows if _value(row, '年度', 'year', 'YEAR') == latest_year]

    items = [
        {
            'name': _value(row, '作物', 'crop', 'CROP'),
            'county': county,
            'township': _value(row, '鄉鎮', 'township', 'TOWN'),
            'year': latest_year,
            'plantingArea': _value(row, '種植面積(公頃)', '種植面積', 'planting_area'),
            'harvestArea': _value(row, '收穫面積(公頃)', '收穫面積', 'harvest_area'),
            'yield': _value(row, '收量(公斤)', '收量', 'yield'),
            'source': SOURCE_URL,
        }
        for row in rows[:limit]
    ]
    return items, latest_year


@router.get('/county-crops')
async def county_crops(
    response: Response,
    county: str = Query(..., min_length=2),
    limit: int = Query(24, ge=1, le=100),
):
    index = _cache['county_index']

    # 冷啟動只短暫等待；逾時後刷新仍在背景繼續，避免請求卡住 25 秒。
    if not index:
        try:
            await asyncio.wait_for(
                asyncio.shield(_start_refresh()),
                timeout=_COLD_WAIT_SECONDS,
            )
        except TimeoutError as exc:
            raise HTTPException(
                status_code=503,
                detail='農情調查資料正在準備中，請稍後再試。',
                headers={'Retry-After': '3'},
            ) from exc
        index = _cache['county_index']
        if not index:
            raise HTTPException(status_code=502, detail='農業部農情調查暫時無法取得，請稍後再試。')

    # 快取過期 → 背景更新，本次先回傳 stale 資料
    if _is_stale():
        logger.info('[agriculture] 快取已過期，觸發背景更新。')
        _start_refresh()

    rows = index.get(county, [])
    items, latest_year = _format_items(rows, county, limit)
    response.headers['Cache-Control'] = 'public, max-age=300, stale-while-revalidate=86400'

    return {
        'items': items,
        'total': len(items),
        'source': SOURCE_URL,
        'year': latest_year,
        'cached': True,
        'stale': _is_stale(),
        'cacheSource': _cache.get('data_source'),
        'datasetYear': _cache.get('dataset_year'),
    }
