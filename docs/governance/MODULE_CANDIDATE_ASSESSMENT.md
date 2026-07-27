# SmartBuy AI｜Company Module Candidate Assessment

## 1. Assessment rule

A capability is not a Company Module merely because it is reusable inside SmartBuy. It becomes a formal candidate only when responsibility boundaries are clear and a second Product or Studio has a real need.

Statuses used here:

- `product-local`: remain inside SmartBuy.
- `shared-candidate`: compare with a second consumer before extraction.
- `blocked`: not suitable for extraction yet.
- `registry-match-required`: search AI-Workstream again before new implementation.

## 2. Candidate inventory

| Candidate | Current source | Status | Reason |
|---|---|---|---|
| HTTP API client | `frontend/src/lib/apiClient.js` | shared-candidate | Timeout, credentials, error parsing and JSON handling may apply to other React products. |
| Auth and RBAC kernel | `backend/security/roles.py`, auth utilities | shared-candidate | Four-role mapping is SmartBuy-specific, but least-privilege permission enforcement may be reusable. |
| Recommendation JSON cache | `src/recommendation/` | shared-candidate | Cache-first, durable R2 selection, schema validation and single-flight behavior may serve other AI products. |
| R2 object storage adapter | `src/data/r2_sync.py` and recommendation cache implementation | shared-candidate | Storage mechanics may be reusable while object keys and product schemas remain local. |
| Dashboard shell and responsive layout | `frontend/src/layouts/`, `components/shared/` | shared-candidate | Common shell may be reusable after token and navigation boundaries are extracted. |
| CI quality workflow | `.github/workflows/ci.yml` | shared-candidate | Backend, frontend, build-budget and Playwright structure could become a workflow template. |
| Agriculture data and price logic | `src/data/`, `src/anomaly/`, agriculture routers | product-local | Domain data, status labels and buying semantics are SmartBuy differentiation. |
| Role recommendation prompts | `src/recommendation/role_prompts.py` | product-local | Consumer, farmer and merchant advice belongs to SmartBuy product behavior. |
| Rewards and coupons | rewards router and repository | product-local | Business rules, point economics and coupon semantics are Product-specific. |
| Twenty-four solar terms | seasonal data and UI | product-local | Product content and agriculture domain behavior. |

## 3. Extraction boundaries

### API client candidate

Potential reusable boundary:

```text
Base URL normalization
+ credentials policy
+ timeout / AbortController
+ error payload normalization
+ response parsing
```

Must remain Product-local:

- SmartBuy endpoint names.
- User-facing agriculture error wording.
- Product-specific retry or fallback behavior.

### Auth and RBAC candidate

Potential reusable boundary:

```text
role normalization
+ permission validation
+ least-privilege fallback
+ backend dependency helpers
```

Must remain Product-local:

- Roles `consumer`, `farmer`, `merchant`, `admin`.
- SmartBuy permission catalog.
- SmartBuy navigation and feature mapping.

### Recommendation cache candidate

Potential reusable boundary:

```text
versioned JSON document
+ cache-first read
+ create-if-absent write
+ cross-instance lock
+ schema validation
+ durable object-store policy
```

Must remain Product-local:

- Agriculture category catalog.
- Consumer／farmer／merchant prompts.
- Price candidate ranking.
- Recommendation output semantics.

### R2 adapter candidate

Potential reusable boundary:

- Object existence, read and conditional create.
- Credential and endpoint configuration contract.
- Error taxonomy.

Must remain Product-local:

- Bucket key layout.
- Recommendation schema version.
- Market-data object names.

## 4. Promotion requirements

Before any candidate is proposed to AI-Workstream:

1. Identify a second real consumer.
2. Compare security, tenancy, data and performance needs.
3. Define a versioned interface.
4. Separate SmartBuy business behavior.
5. Add independent package or contract tests.
6. Choose delivery type: library, UI package, workflow package, API contract or runtime service.
7. Provide migration and rollback guidance.
8. Submit evidence to the Company Module Registry owner.

## 5. Current adoption decision

The initial `.ai-company/module-lock.yaml` intentionally contains no modules.

This means:

- Registry search was performed.
- No existing Stable Company Module has yet been verified as compatible and packaged for SmartBuy.
- Existing SmartBuy helpers remain Product-local until promotion criteria are met.
- No code is copied into AI-Workstream during this onboarding.

## 6. Recommended first extraction experiment

Start with the smallest low-domain candidate:

```text
frontend API client contract
```

Before extraction, compare it against at least one other active Product frontend. If the second Product has materially different auth, error, SSR or tenancy requirements, keep separate implementations or extract only a smaller transport kernel.
