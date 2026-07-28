import { useEffect, useState } from 'react';

import {
  DEFAULT_IDENTITY_ROLE,
  IDENTITY_ROLE_STORAGE_KEY,
  normalizeIdentityRole,
} from '../config/identityRoles';

const IDENTITY_ROLE_CHANGE_EVENT = 'smartbuy:identity-role-change';

function readIdentityRole() {
  try {
    return normalizeIdentityRole(localStorage.getItem(IDENTITY_ROLE_STORAGE_KEY));
  } catch {
    return DEFAULT_IDENTITY_ROLE;
  }
}

export default function useIdentityRole() {
  const [identityRole, setIdentityRoleState] = useState(readIdentityRole);

  useEffect(() => {
    function syncIdentityRole(event) {
      const nextRole = event?.detail?.role ?? localStorage.getItem(IDENTITY_ROLE_STORAGE_KEY);
      setIdentityRoleState(normalizeIdentityRole(nextRole));
    }

    window.addEventListener('storage', syncIdentityRole);
    window.addEventListener(IDENTITY_ROLE_CHANGE_EVENT, syncIdentityRole);
    return () => {
      window.removeEventListener('storage', syncIdentityRole);
      window.removeEventListener(IDENTITY_ROLE_CHANGE_EVENT, syncIdentityRole);
    };
  }, []);

  function setIdentityRole(nextRole) {
    const normalized = normalizeIdentityRole(nextRole);
    setIdentityRoleState(normalized);
    try {
      localStorage.setItem(IDENTITY_ROLE_STORAGE_KEY, normalized);
    } catch {
      // Storage can be unavailable in privacy modes; in-memory selection still works.
    }
    window.dispatchEvent(new CustomEvent(IDENTITY_ROLE_CHANGE_EVENT, { detail: { role: normalized } }));
  }

  return { identityRole, setIdentityRole };
}
