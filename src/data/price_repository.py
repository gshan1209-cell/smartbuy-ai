"""
模組名稱: src.data.price_repository
功能說明: 提供統一的價格資料讀取層，優先從 Supabase 資料庫讀取農產品行情，失敗或離線時 fallback 備援載入本機 CSV。

【相關元件 (Related Components)】
- 依賴: src.data.data_loader.load_market_prices
- 依賴: src.data.data_loader.latest_market_rows
- 依賴: sqlalchemy
- 依賴: pandas
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
import pandas as pd
from sqlalchemy import create_engine, text

from src.data.database_url import load_database_url

_engine = None  # 共用單一 engine，避免 Supabase session mode 連線數超限
_engine_url = None


def _get_engine():
    global _engine, _engine_url
    url = _load_database_url()
    if not url:
        _engine = None
        _engine_url = None
        return None

    if url.startswith("sqlite"):
        try:
            return create_engine(url, pool_pre_ping=True)
        except Exception:
            return None

    if _engine is None or _engine_url != url:
        try:
            _engine = create_engine(
                url,
                pool_pre_ping=True,
                pool_size=3,
                max_overflow=2,
            )
            _engine_url = url
        except Exception:
            _engine = None
            _engine_url = None
    return _engine


def _load_database_url() -> str | None:
    """
    讀取 DATABASE_URL。
    目前正式後端以環境變數提供資料庫連線字串。
    """
    return load_database_url()


def load_latest_prices(limit: int = 200) -> pd.DataFrame:
    """
    載入最新交易日的所有農產品價格。

    參數:
        limit: 最大回傳筆數。

    回傳:
        pd.DataFrame: 最新交易日的價格資料，含 attrs["source"] 來源標記。
    """
    engine = _get_engine()
    if engine:
        try:
            # 取得最新交易日
            with engine.connect() as conn:
                max_date_row = conn.execute(text("SELECT MAX(trans_date) FROM agri_price_daily;")).first()
                max_date = max_date_row[0] if max_date_row else None

            if max_date is not None:
                query = text(
                    """
                    SELECT trans_date, crop_code, crop_name, market_code, market_name, 
                           upper_price, middle_price, lower_price, avg_price, volume
                    FROM agri_price_daily
                    WHERE trans_date = :max_date
                    ORDER BY crop_name
                    LIMIT :limit;
                    """
                )
                df = pd.read_sql(query, engine, params={"max_date": max_date, "limit": limit})

                # 標準化欄位：確保同時支援 crop_name 與 product_name
                df["product_name"] = df["crop_name"]
                df.attrs["source"] = "Supabase"
                return df
            else:
                print("Supabase 中無可用價格資料，將 fallback 到本機 CSV。")
        except Exception as e:
            print(f"Supabase load_latest_prices 失敗，將 fallback 到本機 CSV。錯誤: {e}")

    # Fallback to local CSV
    from src.data.data_loader import latest_market_rows
    df = latest_market_rows()
    df = df.head(limit).copy()
    df["crop_name"] = df["product_name"]
    df["crop_code"] = ""
    # 補齊 Supabase 獨有欄位
    for col in ["upper_price", "middle_price", "lower_price"]:
        df[col] = None
    df.attrs["source"] = "本機 CSV"
    return df


def search_prices(
    keyword: str | None = None,
    market_name: str | None = None,
    crop_name: str | None = None,
    limit: int = 200,
) -> pd.DataFrame:
    """
    搜尋農產品價格。支援關鍵字模糊搜尋及特定作物、市場精確篩選。

    參數:
        keyword: 作物名稱或市場名稱的關鍵字（模糊搜尋）。
        market_name: 市場名稱（精確篩選）。
        crop_name: 作物名稱（精確篩選）。
        limit: 最大回傳筆數。

    回傳:
        pd.DataFrame: 搜尋結果資料，含 attrs["source"] 來源標記。
    """
    engine = _get_engine()
    if engine:
        try:
            sql = (
                "SELECT trans_date, crop_code, crop_name, market_code, market_name, "
                "       upper_price, middle_price, lower_price, avg_price, volume "
                "FROM agri_price_daily "
                "WHERE 1=1"
            )
            params: dict[str, any] = {"limit": limit}
            if crop_name:
                sql += " AND crop_name = :crop_name"
                params["crop_name"] = crop_name
            if market_name:
                sql += " AND market_name = :market_name"
                params["market_name"] = market_name
            if keyword:
                sql += " AND (crop_name LIKE :keyword OR market_name LIKE :keyword)"
                params["keyword"] = f"%{keyword}%"

            sql += " ORDER BY trans_date DESC, crop_name ASC LIMIT :limit;"

            df = pd.read_sql(text(sql), engine, params=params)
            df["product_name"] = df["crop_name"]
            df.attrs["source"] = "Supabase"
            return df
        except Exception as e:
            # 只有在連線或查詢出現例外時才進行 fallback。若正常查詢完成但無結果，則不會進入此區塊。
            print(f"Supabase search_prices 失敗，將 fallback 到本機 CSV。錯誤: {e}")

    # Fallback to local CSV
    from src.data.data_loader import load_market_prices
    df = load_market_prices()
    df["crop_name"] = df["product_name"]
    df["crop_code"] = ""
    for col in ["upper_price", "middle_price", "lower_price"]:
        df[col] = None

    # 進行本機過濾
    if crop_name:
        df = df[df["crop_name"] == crop_name]
    if market_name:
        df = df[df["market_name"] == market_name]
    if keyword:
        df = df[df["crop_name"].str.contains(keyword, na=False) | df["market_name"].str.contains(keyword, na=False)]

    df = df.sort_values(by=["trans_date", "crop_name"], ascending=[False, True]).head(limit).copy()
    df.attrs["source"] = "本機 CSV"
    return df


def load_price_history(
    crop_name: str | None = None,
    crop_code: str | None = None,
    market_name: str | None = None,
    market_code: str | None = None,
    days: int = 90,
    reference_date: date | None = None,
) -> pd.DataFrame:
    """
    載入指定作物與市場在指定天數內的價格歷史走勢。

    參數:
        crop_name: 作物名稱。
        crop_code: 作物代號。
        market_name: 市場名稱。
        market_code: 市場代號。
        days: 歷史天數。
        reference_date: 基準日期。若未提供，則預設為當前系統日期。

    回傳:
        pd.DataFrame: 歷史價格走勢，含 attrs["source"] 來源標記。
    """
    if reference_date is None:
        reference_date = datetime.now().date()
    elif isinstance(reference_date, datetime):
        reference_date = reference_date.date()

    start_date = reference_date - timedelta(days=days)
    engine = _get_engine()
    if engine:
        try:
            sql = (
                "SELECT trans_date, crop_code, crop_name, market_code, market_name, "
                "       upper_price, middle_price, lower_price, avg_price, volume "
                "FROM agri_price_daily "
                "WHERE trans_date >= :start_date"
            )
            params: dict[str, any] = {"start_date": start_date}

            if crop_name:
                sql += " AND crop_name = :crop_name"
                params["crop_name"] = crop_name
            if crop_code:
                sql += " AND crop_code = :crop_code"
                params["crop_code"] = crop_code
            if market_name:
                sql += " AND market_name = :market_name"
                params["market_name"] = market_name
            if market_code:
                sql += " AND market_code = :market_code"
                params["market_code"] = market_code

            sql += " ORDER BY trans_date ASC;"

            df = pd.read_sql(text(sql), engine, params=params)
            df["product_name"] = df["crop_name"]
            df.attrs["source"] = "Supabase"
            return df
        except Exception as e:
            print(f"Supabase load_price_history 失敗，將 fallback 到本機 CSV。錯誤: {e}")

    # Fallback to local CSV
    from src.data.data_loader import load_market_prices
    df = load_market_prices()
    df["crop_name"] = df["product_name"]
    df["crop_code"] = ""
    for col in ["upper_price", "middle_price", "lower_price"]:
        df[col] = None

    # 本機過濾
    df["trans_date_dt"] = pd.to_datetime(df["trans_date"])
    df = df[df["trans_date_dt"].dt.date >= start_date]

    if crop_name:
        df = df[df["crop_name"] == crop_name]
    if market_name:
        df = df[df["market_name"] == market_name]

    df = df.sort_values("trans_date").drop(columns=["trans_date_dt"]).copy()
    df.attrs["source"] = "本機 CSV"
    return df


def get_latest_trans_date() -> tuple[str | None, str]:
    """
    取得最新交易日與資料來源。

    回傳:
        tuple[str | None, str]: (最新交易日字串 YYYY-MM-DD 或 None, 資料來源名稱)
    """
    engine = _get_engine()
    if engine:
        try:
            with engine.connect() as conn:
                max_date_row = conn.execute(text("SELECT MAX(trans_date) FROM agri_price_daily;")).first()
                max_date = max_date_row[0] if max_date_row else None
            if max_date is not None:
                date_str = max_date.strftime("%Y-%m-%d") if isinstance(max_date, (date, datetime)) else str(max_date)
                return date_str, "Supabase"
        except Exception as e:
            print(f"Supabase get_latest_trans_date 失敗，將使用本機 CSV 最新日期。錯誤: {e}")

    # Fallback to CSV
    from src.data.data_loader import load_market_prices
    try:
        df = load_market_prices()
        if not df.empty:
            max_date = df["trans_date"].max()
            date_str = max_date.strftime("%Y-%m-%d") if isinstance(max_date, (date, datetime, pd.Timestamp)) else str(max_date)
            return date_str, "本機 CSV"
    except Exception:
        pass
    return None, "本機 CSV"
