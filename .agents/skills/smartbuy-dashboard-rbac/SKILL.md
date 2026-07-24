---
name: smartbuy-dashboard-rbac
description: Use when implementing or reviewing SmartBuy AI dashboards, admin tools, farmer or merchant modules, sidebar navigation, role guards, permissions, or management workflows. Do not use for consumer-only public pages.
---

# SmartBuy Dashboard and RBAC

## Purpose

Build a consistent operational dashboard while enforcing the four formal roles in both frontend and backend.

## Read first

- `/AGENT.md`
- `/AGENTS.md`
- `/docs/uiux/DASHBOARD_VISUAL_STYLE_REFERENCE.md`

## Formal roles

```text
consumer
farmer
merchant
admin
```

Do not introduce `operator`, `staff`, or another role value without an explicit project-wide migration decision.

## Workflow

1. Identify the management capability, target role, route, data source, and write actions.
2. Inspect current `DashboardLayout`, sidebar, guards, route configuration, backend dependencies, and permission checks.
3. Define a permission matrix before implementation:

| Capability | consumer | farmer | merchant | admin |
|---|---:|---:|---:|---:|
| View | no | explicit | explicit | yes |
| Create | no | explicit | explicit | yes |
| Update | no | explicit | explicit | yes |
| Delete or publish | no | explicit | explicit | yes |

Replace `explicit` with the real decision for the feature.

4. Implement frontend route and action guards through centralized `ProtectedRoute`, `RoleGuard`, or `PermissionGuard` logic.
5. Implement backend role or permission verification for every protected management API.
6. Treat unknown and legacy roles as the lowest privilege.
7. Keep Public App and Dashboard layouts separate.
8. Follow dashboard visual structure:
   - dark green fixed sidebar on desktop
   - white topbar
   - light gray or warm gray content background
   - white KPI, chart, table, and alert cards
   - green for normal or primary action
   - amber for attention
   - red for error or high risk
   - blue for information or neutral status
9. Verify layout behavior:
   - Desktop: fixed sidebar and four-column KPI where space allows
   - Tablet: collapsible sidebar and two-column KPI
   - Mobile: sidebar becomes drawer and KPI becomes one column
10. Verify forbidden routes and APIs directly, not only hidden menu items.
11. Run the quality gate skill.

## Guardrails

- Hiding a sidebar item is not authorization.
- Consumers must not enter Dashboard routes.
- Farmers and merchants may only access explicitly granted modules.
- Admin access must not be inferred from an unknown role.
- Destructive actions require clear confirmation and backend enforcement.
- Do not use fake KPI values without a visible demo or unavailable label.
- Do not copy the reference brand, logo, wording, or sample data.

## Deliverables

- Centralized route and action permission changes.
- Backend permission checks for protected APIs.
- Permission matrix in code, tests, or task documentation.
- Mobile, Tablet, and Desktop dashboard verification.
- Positive and negative authorization test evidence.

## Completion criteria

The task is complete when each formal role sees only permitted navigation and actions, direct route and API access are enforced, unknown roles remain low privilege, and the dashboard remains usable on all three target sizes.
