---
name: smartbuy-api-change
description: Use when implementing or reviewing FastAPI routers, Pydantic schemas, SQLAlchemy models, Supabase/PostgreSQL access, JWT authentication, cookies, caching, background jobs, or API contracts in SmartBuy AI. Do not use for documentation-only or frontend-only changes.
---

# SmartBuy API Change

## Purpose

Make backend changes that are compatible, authorized, observable, and safe under external API or database failure.

## Read first

- `/AGENT.md`
- `/AGENTS.md`
- Existing router, schema, service, model, dependency, and test files related to the endpoint

## Workflow

1. Map the current request flow from frontend caller to router, dependency, service, database or external source, response schema, and error handling.
2. Record the current API contract before editing:
   - method and path
   - authentication
   - allowed roles
   - request fields
   - response fields
   - status codes
   - pagination, sorting, and filters
   - cache behavior
3. Prefer additive and backward-compatible changes.
4. When a breaking change is unavoidable, provide migration steps, compatibility period or versioning, and affected callers.
5. Keep validation in Pydantic schemas or centralized domain logic rather than duplicating ad hoc checks.
6. Enforce authorization in backend dependencies or services. Frontend guards are not sufficient.
7. Use parameterized ORM or database operations. Never concatenate untrusted input into SQL.
8. Define transaction boundaries for multi-step writes and ensure partial failure does not leave inconsistent state.
9. For external APIs, implement bounded timeout, meaningful error handling, and appropriate retry or stale-cache behavior.
10. For caches and background tasks, define startup, shutdown, refresh, concurrency, failure recovery, and memory limits.
11. Avoid logging passwords, JWTs, cookies, database URLs, API keys, or personal data.
12. Preserve data provenance and freshness metadata for agriculture, weather, market, seasonal, and AI responses.
13. Add or update tests for:
   - happy path
   - validation failure
   - unauthenticated request
   - unauthorized role
   - missing record
   - dependency timeout or unavailable source
   - backward compatibility where relevant
14. Update caller code and documentation when the contract changes.
15. Run the quality gate skill.

## Database change rules

- Inspect existing schema and migrations before changing models.
- Do not rely on automatic table creation as a production migration strategy.
- New required columns need defaults, backfill, or a staged nullable migration.
- Destructive schema changes require backup and rollback planning.
- Indexes should match real query patterns and avoid unnecessary write cost.

## Authentication and role rules

- Formal roles are only `consumer`, `farmer`, `merchant`, and `admin`.
- Unknown roles receive the lowest privilege.
- Production cannot use a default or weak JWT secret.
- Cookies and tokens must follow the project’s existing secure handling pattern.
- Management endpoints require explicit backend permission checks.

## Guardrails

- Do not remove an existing field, route, filter, or status code without checking all callers.
- Do not replace production data access with mock data.
- Do not catch all exceptions and return a misleading successful response.
- Do not start unbounded background tasks or retries.
- Do not expose internal stack traces or secrets to clients.
- Do not use a successful `/health` response as proof that business endpoints work.

## Deliverables

- Updated backend implementation and schemas.
- Migration or compatibility notes when applicable.
- Authorization tests and contract tests.
- External dependency failure behavior.
- Updated frontend caller or API documentation when required.

## Completion criteria

The task is complete when existing callers remain functional or have a documented migration path, protected actions are enforced in the backend, failure states are truthful, and tests cover both success and meaningful negative cases.
