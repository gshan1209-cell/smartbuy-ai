---
name: smartbuy-quality-gate
description: Use before declaring any SmartBuy AI feature, refactor, bug fix, or pull request complete. Covers build, tests, regression, responsive UI, permissions, data-source truthfulness, and delivery evidence. Do not use as a substitute for implementing the task.
---

# SmartBuy Quality Gate

## Purpose

Prevent incomplete delivery that only compiles while existing behavior, permissions, responsive layouts, or data meaning have regressed.

## Inputs

- Task goal and acceptance criteria.
- Changed files and diff.
- Existing behavior identified before implementation.
- Available local, CI, preview, API, and database environments.

## Workflow

1. Re-read the task acceptance criteria and list each item as pass, fail, blocked, or not applicable.
2. Review the diff for accidental deletion, disabled code, replaced API calls, role bypasses, hardcoded demo data, missing error handling, and unrelated changes.
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
python -m pytest
```

Use narrower test commands first when appropriate, then the broader suite if the environment permits.

6. Frontend baseline when affected:

```bash
cd frontend
npm install
npm run build
```

Run lint or test scripts too when they exist in `package.json`.

7. Verify API behavior beyond `/health`:
   - representative success request
   - validation failure
   - unauthenticated access
   - unauthorized role
   - unavailable dependency where relevant
8. Verify role boundaries for `consumer`, `farmer`, `merchant`, `admin`, and an unknown role.
9. Verify responsive UI when changed:
   - 390 × 844 and 360px minimum width
   - 834 × 1112
   - 1440 × 900
10. Verify loading, empty, error, stale, unavailable, and recovery states for data-driven UI.
11. Verify agriculture, weather, market, seasonal, and AI outputs disclose source, freshness, method, or limitation as required.
12. Check accessibility basics: keyboard operation, visible focus, labels, contrast, text scaling, and touch targets.
13. Check secrets and logs. Ensure no credential, cookie, JWT, database URL, or personal data was committed or exposed.
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

## Required delivery report

```markdown
## Change summary

## Acceptance criteria
- [x] Passed
- [ ] Blocked: reason

## Automated verification
- `command` → result

## Manual verification
- Mobile
- Tablet
- Desktop
- Roles and permissions
- Data states

## Regression check

## Risks, limitations, and follow-up
```

## Guardrails

- Build success alone is not acceptance.
- A hidden menu item alone is not authorization.
- A screenshot alone is not proof that interactions or APIs work.
- Do not ignore failing tests as unrelated without evidence.
- Do not approve a task that silently reduces existing functionality.
- Do not mark unavailable external dependencies as successfully verified.
- Do not invent test results.

## Completion criteria

The quality gate passes only when acceptance criteria are traceable to evidence, material regressions are checked, role and data boundaries remain truthful, and any blocked verification is clearly disclosed rather than hidden.
