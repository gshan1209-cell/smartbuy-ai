---
name: smartbuy-quality-gate
description: 適用於宣告任何 SmartBuy AI 功能、重構、錯誤修正或 Pull Request 完成之前，涵蓋建置、單元測試、瀏覽器 E2E、功能回歸、響應式介面、無障礙、權限、資料來源真實性、前端 bundle 預算與交付證據；不得用來取代實際開發工作。
---

# SmartBuy Quality Gate

## Purpose

Prevent incomplete delivery that only compiles while existing behavior, permissions, browser interactions, responsive layouts, performance budgets, accessibility, or data meaning have regressed.

## Inputs

- Task goal and acceptance criteria.
- Changed files and diff.
- Existing behavior identified before implementation.
- Available local, CI, preview, API, browser, and database environments.

## Workflow

1. Re-read the task acceptance criteria and list each item as pass, fail, blocked, or not applicable.
2. Review the diff for accidental deletion, disabled code, replaced API calls, role bypasses, hardcoded demo data, missing error handling, unrelated changes, synchronous imports that pull route-only code into the entry bundle, and E2E tests that call production services.
3. Compare the before-and-after feature checklist. At minimum consider:
   - login, registration, logout
   - search and product detail
   - basket and favorites
   - alerts and notifications
   - news and seasonal content
   - mutual-aid posts, comments, likes, and images
   - settings and dark mode
   - dashboard navigation and actions
   - existing API contracts
4. Run the most relevant automated checks available in the repository.
5. Backend baseline when affected:

```bash
python -m pip install -r requirements.txt
python -m compileall -q backend src tests
python -m pytest
```

Use narrower test commands first when appropriate, then the broader suite if the environment permits.

When changing Python tests, also read `docs/architecture/TESTING_STRUCTURE.md` and verify:

- Router unit tests use a minimal app rather than importing the deployment entry without need.
- FastAPI authentication and other `Depends` values use `dependency_overrides`.
- `monkeypatch` targets the module that actually looks up the dependency.
- No test installs fake modules into `sys.modules` at module import time.
- Focused tests pass together with the full suite, so test-order pollution is not hidden.

6. Frontend baseline when affected:

```bash
cd frontend
npm ci
npm test
npm run build:check
```

For route, authentication, permission, layout, navigation, focus, form label, breakpoint, Error Boundary, 404, chart, map, recommendation, or large page changes, also run the browser gate:

```bash
cd frontend
npm install --no-save --no-package-lock @playwright/test@1.61.1
npx playwright install chromium
npm run build
npm run test:e2e
```

Also read:

- `docs/architecture/FRONTEND_PERFORMANCE_RESILIENCE.md`
- `docs/architecture/E2E_ACCESSIBILITY_TESTING.md`

Verify:

- Route-only pages remain dynamic imports through `lazyWithRetry`.
- Public and Dashboard unknown URLs have a 404 route.
- A visible, accessible Suspense fallback exists.
- Render failures are caught by `AppErrorBoundary`.
- Stale deployment chunks reload at most once and cannot enter a reload loop.
- Initial and largest JavaScript chunks remain within the checked build budget.
- Build-budget thresholds are not raised without evidence and explicit review.
- Browser E2E uses deterministic `/api/**` mocks and never writes to production.
- Desktop, Tablet, and Mobile projects remain enabled.
- Failed browser tests keep trace, screenshot, video, and HTML report artifacts.

7. Verify API behavior beyond `/health`:
   - representative success request
   - validation failure
   - unauthenticated access
   - unauthorized role
   - unavailable dependency where relevant
8. Verify role boundaries for `consumer`, `farmer`, `merchant`, `admin`, and an unknown role.
9. Verify responsive UI when changed:
   - automated: 390 × 844, 1024 × 768, 1440 × 900
   - manual when material: 360px minimum width and 834 × 1112
10. Verify loading, empty, error, stale, unavailable, and recovery states for data-driven UI.
11. Verify agriculture, weather, market, seasonal, and AI outputs disclose source, freshness, method, or limitation as required.
12. Check accessibility basics: keyboard operation, visible focus, labels, accessible names, contrast, text scaling, touch targets, reduced motion, screen-reader loading announcements, and no horizontal overflow at the minimum width.
13. Check secrets and logs. Ensure no credential, cookie, JWT, database URL, personal data, real test account, or full production error payload was committed or exposed.
14. Record every command actually run and its result. Never claim a check was run when it was not.
15. Mark environment-blocked checks clearly and provide the exact remaining manual verification.

## High-risk diff review

Treat these as requiring explicit explanation:

- Large deletion in an existing page or router.
- Removal of API calls, filters, charts, notifications, or error states.
- Role or authentication changes.
- Database schema or migration changes.
- Background task, cache, timeout, or retry changes.
- New external data source.
- Changed meaning of price, weather risk, seasonal advice, or AI prediction.
- New destructive management action.
- Module-level `sys.modules` replacement, shared mutable test state, or a test that only passes when run alone.
- Disabling route-level lazy loading or increasing bundle budgets.
- Chunk retry logic that can repeatedly reload the page.
- Removing Browser E2E, Mobile, or Tablet coverage.
- Browser tests that depend on live Render, Supabase, R2, LLM, or production credentials.
- Increasing Playwright retries or adding permanent skips instead of fixing deterministic failures.

## Required delivery report

```markdown
## Change summary

## Acceptance criteria
- [x] Passed
- [ ] Blocked: reason

## Automated verification
- `command` → result

## Browser E2E
- Desktop / Tablet / Mobile
- Keyboard and accessible-name checks
- Auth allow / deny / fail-closed
- Trace / screenshot / video artifact status

## Frontend performance
- Initial JS raw / gzip
- Largest chunk raw / gzip
- Vercel Preview status

## Manual verification
- Mobile
- Tablet
- Desktop
- Roles and permissions
- Data states
- Loading, Error Boundary, 404, and chunk recovery

## Regression check

## Risks, limitations, and follow-up
```

## Guardrails

- Build success alone is not acceptance.
- A hidden menu item alone is not authorization.
- A screenshot alone is not proof that interactions or APIs work.
- A mocked browser test is evidence of frontend behavior only, not production API health.
- Do not ignore failing tests as unrelated without evidence.
- Do not approve a task that silently reduces existing functionality.
- Do not mark unavailable external dependencies as successfully verified.
- Do not invent test results.
- Do not permanently exclude a test merely because it pollutes imports or depends on execution order; fix the isolation boundary.
- Do not hide bundle growth by raising `chunkSizeWarningLimit` or build-budget thresholds.
- Do not point ordinary E2E tests at production databases or use real member credentials.
- Do not treat Vercel quota, Preview protection, or third-party outage as an application pass or failure without separating platform status from code evidence.

## Completion criteria

The quality gate passes only when acceptance criteria are traceable to evidence, material regressions are checked, browser interaction and accessibility smoke tests pass where applicable, route and error recovery remain usable, performance budgets pass, role and data boundaries remain truthful, and any blocked verification is clearly disclosed rather than hidden.
