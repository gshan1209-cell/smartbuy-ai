# TASK-T01 交接摘要：任務資料

## 已完成

- 任務 JSON 格式、完整欄位驗證、五條件篩選、排序、統計與安全狀態更新。
- 任務中心已收錄規格書的 28 筆 MVP 任務。

## 尚未完成

- 尚未加入跨程序檔案鎖；目前以原子取代避免寫到一半留下損壞 JSON。

## 已知問題

JSON 適合單機 MVP，多人同時寫入仍應透過任務認領與 Git 分支協作。

## 接手前必讀

- `data/tasks/tasks.json`
- `src/tasks/task_loader.py`
- `src/tasks/task_status.py`

## 測試指令

`python -m pytest tests/test_task_loader.py -q`
