export const ROLES = { consumer: '消費者', farmer: '農民', merchant: '商家', admin: '系統管理員' };
export const VALID_ROLES = Object.keys(ROLES);
export function normalizeRole(role) { return VALID_ROLES.includes(role) ? role : 'consumer'; }
