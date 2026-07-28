import { ROLES, VALID_ROLES } from './roles.js';

export const IDENTITY_ROLE_STORAGE_KEY = 'smartbuy_identity_role';
export const DEFAULT_IDENTITY_ROLE = 'admin';

export const IDENTITY_ROLE_OPTIONS = VALID_ROLES.map(value => ({
  value,
  label: ROLES[value],
}));

export function normalizeIdentityRole(role) {
  return VALID_ROLES.includes(role) ? role : DEFAULT_IDENTITY_ROLE;
}
