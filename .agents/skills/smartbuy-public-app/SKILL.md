---
name: smartbuy-public-app
description: Use when implementing or reviewing SmartBuy AI consumer-facing pages, navigation, search, product detail, basket, alerts, seasonal content, news, mutual aid, settings, or responsive UI. Do not use for dashboard-only administration work.
---

# SmartBuy Public App

## Purpose

Deliver a simple, plain-language, mobile-first consumer experience without removing existing features or hiding data limitations.

## Read first

- `/AGENT.md`
- `/AGENTS.md`
- `/docs/uiux/PUBLIC_HOME_VISUAL_STYLE_REFERENCE.md` for homepage, Taiwan map, county, month, and produce exploration work

## Workflow

1. Identify the target route and current user journey.
2. Inspect the existing component, state, API calls, loading state, empty state, error state, dark mode behavior, and related navigation.
3. List all existing actions that must remain usable before changing the UI.
4. Define the primary user question in plain language, such as:
   - 今天買什麼？
   - 這個品項最近便宜嗎？
   - 哪些菜可能受天氣影響？
   - 現在是什麼節氣、適合買什麼？
5. Keep the first screen focused on the primary task. Move secondary exploration lower instead of replacing search, buying advice, favorites, or alerts.
6. Reuse shared tokens and components. Avoid creating page-specific styles that duplicate the design system.
7. Implement all data states:
   - loading
   - success
   - empty
   - stale or delayed
   - unavailable
   - error with recovery action
8. Clearly distinguish `Official API`, `Database`, `Static Seed`, `Demo`, `Cached`, and `Unavailable` data when applicable.
9. Verify responsive behavior at minimum:
   - Mobile: 390 × 844 and no breakage at 360px
   - Tablet: 834 × 1112
   - Desktop: 1440 × 900
10. Verify keyboard use, focus visibility, semantic labels, contrast, readable text size, and touch target size.
11. Run the quality gate skill before delivery.

## Public App invariants

- Public App and Dashboard use separate layouts.
- Mobile uses a concise header and the fixed five-item bottom navigation: 首頁、查菜價、菜籃、提醒、我的.
- A Taiwan map may support exploration, but cannot be the only control; provide chips, list, or select alternatives on mobile.
- Do not copy third-party branding, logos, images, HTML, CSS, or proprietary text.
- Do not remove search, today’s buying advice, favorites, alerts, news, mutual aid, settings, or dark mode merely to simplify the page.
- Do not replace a working API with static data.
- Consumer-facing copy should explain implications and next actions, not only expose raw numbers.

## Deliverables

- Updated UI and related components.
- Any necessary API integration changes, delegated to `smartbuy-api-change` when backend work is required.
- Screens or notes showing Mobile, Tablet, and Desktop verification.
- A regression list of preserved actions.
- Clear disclosure of mock, cached, stale, or unavailable data.

## Completion criteria

The task is complete when the primary consumer journey works on all three target sizes, existing actions remain available, data states are understandable, and no dashboard or permission behavior is accidentally exposed through the public layout.
