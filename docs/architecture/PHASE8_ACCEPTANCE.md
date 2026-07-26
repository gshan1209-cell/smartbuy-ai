# Phase 8｜Browser E2E 與 Accessibility Acceptance

## Scope

- 不執行或修改資料庫 migration。
- 不連接正式 Render、Supabase、R2 或 LLM。
- 不使用真實帳號、Cookie 或 Token。
- 以 production Vite build + Chromium 驗證前端。

## Automated acceptance

- Node frontend regression tests。
- Vite production build 與 bundle budget。
- Desktop 1440 × 900 全套 E2E。
- Tablet 1024 × 768 responsive E2E。
- Mobile 390 × 844 responsive E2E。
- Public search keyboard flow。
- Public 404 recovery。
- Anonymous dashboard redirect。
- Dashboard allow / deny / fail-closed。
- Visible interactive accessible names。
- Initial keyboard focus。
- Horizontal overflow。
- Mobile dashboard drawer navigation。

## Platform separation

Vercel Preview quota or deployment protection is recorded separately from code acceptance. GitHub CI browser tests are the source of truth for this phase because they run the built frontend locally with deterministic API responses.
