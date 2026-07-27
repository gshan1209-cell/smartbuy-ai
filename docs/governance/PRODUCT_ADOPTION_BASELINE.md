# SmartBuy AI｜Company Product Adoption Baseline

## 1. Purpose

This document records the verified repository-level baseline used to onboard `gshan1209-cell/smartbuy-ai` into the company modular architecture managed by `AI-CEO-Control-Tower`.

The migration mode is `adopt-in-place`. This onboarding does not move the repository, replace the product runtime, change deployment providers, rewrite the database, or remove existing features.

## 2. Product identity

- Product ID: `smartbuy-ai`
- Product kind: `software-product`
- Product line: `consumer-intelligence`
- Primary operating unit: `system-development-studio`
- Participating units: `multimedia-studio`, `ai-module-factory`
- Lifecycle mode: `triad-full-cycle`
- Migration wave: `WAVE-01-CORE-PRODUCTS`
- Current migration state: `registered`

## 3. Verified repository structure

The repository currently separates:

- `backend/`: FastAPI transport and application layer
- `src/`: framework-independent data, recommendation, feature and model capabilities
- `frontend/`: React 19 and Vite application
- `tests/`: Python test suite
- `frontend/e2e/`: Playwright browser and responsive tests
- `.agents/skills/`: SmartBuy-specific Agent Skills
- `.github/workflows/ci.yml`: backend, frontend and browser quality workflow

Stable backend entry:

```text
backend/main.py
→ backend/application.py
→ backend/api/router.py + backend/core/lifecycle.py
→ backend/routers + src/
```

Stable frontend direction:

```text
frontend/src/App.jsx
→ frontend/src/routes/AppRoutes.jsx
→ layouts / pages / components
→ domain API services
→ frontend/src/lib/apiClient.js
```

## 4. Build and test baseline

Documented commands:

```bash
python -m pip install -r requirements.txt
python -m pytest

cd frontend
npm ci
npm test
npm run build:check
npm run test:e2e
```

CI workflow currently defines:

1. Python 3.12 compile and pytest.
2. Node.js 20 frontend tests and bundle-budget build.
3. Chromium Playwright E2E and accessibility checks for desktop, tablet and mobile viewports.

Status for this adoption change:

| Area | Status | Meaning |
|---|---|---|
| Commands | documented | Repository defines reproducible commands. |
| CI workflow | verified-present | Workflow file was inspected. |
| Backend tests | not-run | Not executed by this governance-only onboarding. |
| Frontend tests/build | not-run | Not executed by this governance-only onboarding. |
| Browser E2E | not-run | Not executed by this governance-only onboarding. |
| Production health | not-verified | No production endpoint was probed in this change. |

The repository cannot move to `baseline-complete` until actual evidence is attached.

## 5. Deployment baseline

Repository documentation and configuration identify:

| Component | Target | Evidence type |
|---|---|---|
| Frontend | Vercel | README and `frontend/vercel.json` |
| Backend | Render | `render.yaml` |
| Database | Supabase PostgreSQL | README and environment contract |
| Historical data lake | Cloudflare R2 / Parquet | README and source configuration |
| Scheduled data and prediction work | GitHub Actions | README and workflow configuration |

The Render contract currently starts:

```text
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

The application exposes `/health`, but the production health result remains unverified in this onboarding.

## 6. Product-specific capabilities

The following remain owned by the SmartBuy Product repository:

- Agriculture market intelligence and plain-language buying guidance
- Next-trading-day price direction prediction
- Seasonal and twenty-four-solar-term recommendations
- Consumer, farmer and merchant recommendation behavior
- Mutual-aid network and product discovery behavior
- Reward points and coupon business rules
- SmartBuy role and permission semantics

These are product differentiation and must not be moved into Company Modules merely to increase reuse counts.

## 7. Shared capability candidates

Potential candidates were recorded separately in:

```text
docs/governance/MODULE_CANDIDATE_ASSESSMENT.md
```

No candidate is marked Stable or adopted in `.ai-company/module-lock.yaml`. Promotion requires a second real consumer, interface extraction, independent tests, versioned delivery and AI-Workstream owner review.

## 8. Independent operation

SmartBuy must remain buildable, testable, deployable and releasable without a live CEO Control Tower or Studio runtime.

```text
CEO unavailable
≠ AI-Showcase-Studio unavailable
≠ AI-Workstream unavailable
≠ SmartBuy unavailable
```

Company systems provide governance, reusable packages and status aggregation; they are not required for normal Product runtime unless a future explicitly versioned runtime service is adopted.

## 9. Exit criteria for baseline-complete

- Backend test evidence attached.
- Frontend regression and build evidence attached.
- Browser E2E and accessibility result attached, including known failures when present.
- Frontend deployment reference checked.
- Backend `/health` reference checked.
- Database and R2 configuration boundaries confirmed without exposing secrets.
- First Release Record updated from `draft` to an evidence-supported state.
- Rollback or withdrawal procedure documented.

## 10. Integrity rules

- Do not fabricate historical requirements, test passes, uptime or deployment health.
- Do not copy secrets into Git or ordinary Drive folders.
- Do not delete or replace existing runtime behavior during onboarding.
- Do not mark a local helper as a Company Module without evidence and formal ownership.
- Keep `reported`, `verified`, `approved` and `released` separate.
