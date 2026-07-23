from functools import lru_cache
import requests
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix='/api/agriculture', tags=['agriculture'])
SOURCE_URL = 'https://data.moa.gov.tw/Service/OpenData/FromM/TownCropData.aspx?IsTransData=1&UnitId=038'

def _value(row, *keys):
    for key in keys:
        if row.get(key) not in (None, ''):
            return row[key]
    return None

@lru_cache(maxsize=1)
def _load_official_rows():
    response = requests.get(SOURCE_URL, timeout=20)
    response.raise_for_status()
    payload = response.json()
    return payload if isinstance(payload, list) else payload.get('data', payload.get('result', []))

@router.get('/county-crops')
def county_crops(county: str = Query(..., min_length=2), limit: int = Query(24, ge=1, le=100)):
    try:
        rows = _load_official_rows()
    except Exception as exc:
        raise HTTPException(status_code=502, detail='農業部農情調查暫時無法取得。') from exc
    matched = [row for row in rows if str(_value(row, '縣市', 'county', 'COUNTYNAME') or '').strip() == county]
    latest_year = max((_value(row, '年度', 'year', 'YEAR') for row in matched), default=None)
    if latest_year is not None:
        matched = [row for row in matched if _value(row, '年度', 'year', 'YEAR') == latest_year]
    items = [{
        'name': _value(row, '作物', 'crop', 'CROP'), 'county': county,
        'township': _value(row, '鄉鎮', 'township', 'TOWN'), 'year': latest_year,
        'plantingArea': _value(row, '種植面積(公頃)', '種植面積', 'planting_area'),
        'harvestArea': _value(row, '收穫面積(公頃)', '收穫面積', 'harvest_area'),
        'yield': _value(row, '收量(公斤)', '收量', 'yield'), 'source': SOURCE_URL,
    } for row in matched[:limit]]
    return {'items': items, 'total': len(items), 'source': SOURCE_URL, 'year': latest_year}
