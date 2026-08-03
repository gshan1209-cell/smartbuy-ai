from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.recommendation.daily_snapshot import parse_date, publish_daily_payload


def main() -> None:
    parser = argparse.ArgumentParser(description="驗證並發布 SmartBuy 每日推薦 JSON。")
    parser.add_argument("--date", required=True, help="推薦適用日期，格式 YYYY-MM-DD。")
    parser.add_argument("--input", required=True, type=Path, help="ChatGPT 回傳的 JSON 檔案。")
    parser.add_argument(
        "--public-root",
        type=Path,
        default=PROJECT_ROOT / "frontend" / "public" / "recommendations-daily",
    )
    parser.add_argument(
        "--release-dir",
        help="可選的不覆寫發布目錄名稱；未提供時使用推薦日期 YYYY-MM-DD。",
    )
    args = parser.parse_args()
    try:
        payload = json.loads(args.input.read_text(encoding="utf-8"))
        written = publish_daily_payload(payload, parse_date(args.date), args.public_root, args.release_dir)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"發布失敗，latest.json 未更新：\n{exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    print("每日推薦發布完成：")
    for path in written:
        print(f"- {path}")


if __name__ == "__main__":
    main()
