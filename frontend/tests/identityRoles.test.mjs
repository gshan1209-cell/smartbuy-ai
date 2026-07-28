import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_IDENTITY_ROLE,
  IDENTITY_ROLE_OPTIONS,
  normalizeIdentityRole,
} from '../src/config/identityRoles.js';

test('identity selector exposes the four formal SmartBuy roles', () => {
  assert.deepEqual(
    IDENTITY_ROLE_OPTIONS,
    [
      { value: 'consumer', label: '消費者' },
      { value: 'farmer', label: '農民' },
      { value: 'merchant', label: '商家' },
      { value: 'admin', label: '系統管理員' },
    ],
  );
});

test('identity selector defaults invalid or missing values to system administrator', () => {
  assert.equal(DEFAULT_IDENTITY_ROLE, 'admin');
  assert.equal(normalizeIdentityRole(null), 'admin');
  assert.equal(normalizeIdentityRole('unknown'), 'admin');
  assert.equal(normalizeIdentityRole('farmer'), 'farmer');
});
