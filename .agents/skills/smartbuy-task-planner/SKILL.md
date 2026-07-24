---
name: smartbuy-task-planner
description: 適用於規劃新功能、跨層修改、大型重構、需求不明確，或定義下一個 SmartBuy AI Pull Request；若只是驗收條件已明確的單一小修改，則不應使用。
---

# SmartBuy Task Planner

## Purpose

Turn a request into one reviewable SmartBuy AI task with explicit scope, dependencies, risks, acceptance criteria, and verification steps.

## Required inputs

- User request, Issue, PR comment, or specification.
- Current repository state and relevant existing files.
- Known target role: `consumer`, `farmer`, `merchant`, or `admin`.
- Expected interface: Public App, Dashboard, API, data pipeline, AI, or documentation.

## Workflow

1. Read `/AGENT.md` and `/AGENTS.md`.
2. Restate the task as one outcome that can be independently built, reviewed, and rolled back.
3. Inspect existing routes, components, API endpoints, schemas, data sources, tests, and referenced documents before proposing changes.
4. Build an impact map:
   - Public App
   - Dashboard
   - role and permission
   - FastAPI contract
   - database or migration
   - agriculture, weather, seasonal, market, or AI data
   - deployment and environment variables
   - test and documentation
5. Separate requirements into:
   - in scope
   - explicitly out of scope
   - dependencies
   - assumptions requiring verification
6. Identify existing behavior that must remain available. Pay special attention to login, search, product detail, basket, favorites, alerts, mutual aid, settings, dark mode, RWD, and API compatibility.
7. Select the smallest relevant skills from `.agents/skills/`.
8. Define acceptance criteria that can be observed or tested.
9. Define a verification matrix before implementation.
10. Recommend one PR boundary. Split the work when it mixes unrelated UI, database, AI model, or infrastructure changes.

## Required task plan output

```markdown
# Task title

## Goal

## In scope

## Out of scope

## Existing behavior to preserve

## Affected files and systems

## Selected skills

## Implementation steps

## Acceptance criteria

## Verification

## Risks and rollback
```

## Guardrails

- Do not create a plan based only on filenames or screenshots; inspect the relevant implementation.
- Do not treat Build success as the only acceptance criterion.
- Do not hide missing APIs or unavailable data behind unlabelled demo data.
- Do not introduce new role names beyond the four formal roles.
- Do not plan large code deletion as the default refactoring strategy.
- Do not combine full-site redesign, database redesign, and AI model redesign in one PR.

## Completion criteria

The planning task is complete only when another Agent or developer can implement it without guessing the main scope, preserved behavior, permission boundary, data source, or verification method.
