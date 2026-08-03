from __future__ import annotations

import argparse
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.recommendation.daily_snapshot import parse_date, prepare_daily_inputs, taipei_today


def main() -> None:
    parser = argparse.ArgumentParser(description="整理 SmartBuy 每日推薦所需的行情、預測與新知資料。")
    parser.add_argument("--date", help="推薦適用日期，格式 YYYY-MM-DD；預設為 Asia/Taipei 今日。")
    parser.add_argument("--output-root", type=Path, default=PROJECT_ROOT / "recommendation_inputs")
    args = parser.parse_args()
    recommendation_date = parse_date(args.date) if args.date else taipei_today()
    target_dir = prepare_daily_inputs(recommendation_date, args.output_root)
    print(f"每日推薦輸入已產生：{target_dir}")
    print(f"請開啟：{target_dir / 'chatgpt-prompt.md'}")


if __name__ == "__main__":
    main()
