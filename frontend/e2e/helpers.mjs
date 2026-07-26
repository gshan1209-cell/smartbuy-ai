export const ADMIN_USER = Object.freeze({
  id: 9001,
  name: 'E2E 管理員',
  email: 'admin-e2e@example.test',
  role: 'admin',
});

export const ADMIN_PERMISSIONS = Object.freeze([
  'dashboard.view',
  'prices.view',
  'predictions.view',
  'recommendations.view',
  'weather.view',
  'seasonal.view',
  'coupons.manage',
]);

const unavailablePayload = JSON.stringify({ detail: 'E2E deterministic unavailable response' });

export async function installDeterministicNetwork(page) {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());

  await page.route('**/api/**', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: unavailablePayload,
  }));
}

export async function seedAuthenticatedUser(page, user = ADMIN_USER) {
  await page.addInitScript((storedUser) => {
    window.localStorage.setItem('yz_auth_user', JSON.stringify(storedUser));
  }, user);
}

export async function mockDashboardAccess(page, {
  status = 200,
  user = ADMIN_USER,
  permissions = ADMIN_PERMISSIONS,
  dashboardAccess = true,
} = {}) {
  await page.route('**/api/admin/access', (route) => {
    if (status !== 200) {
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ detail: status === 403 ? 'Forbidden' : 'Unauthorized' }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        role: user.role,
        permissions,
        dashboardAccess,
      }),
    });
  });
}

export async function readViewportMetrics(page) {
  return page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }));
}

export async function readFocusableNameProblems(page) {
  return page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll(
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])',
    ));

    return controls
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const visible = style.display !== 'none'
          && style.visibility !== 'hidden'
          && element.getClientRects().length > 0;
        if (!visible) return false;

        const labelledBy = element.getAttribute('aria-labelledby');
        const labelledText = labelledBy
          ? labelledBy
              .split(/\s+/)
              .map((id) => document.getElementById(id)?.innerText || '')
              .join(' ')
          : '';
        const nativeLabelText = Array.from(element.labels || [])
          .map((label) => label.innerText || '')
          .join(' ');
        const name = [
          element.getAttribute('aria-label'),
          labelledText,
          nativeLabelText,
          element.getAttribute('title'),
          element.innerText,
          element.getAttribute('placeholder'),
          element.getAttribute('alt'),
        ]
          .filter(Boolean)
          .join(' ')
          .trim();

        return !name;
      })
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute('type'),
        className: element.className,
      }));
  });
}
