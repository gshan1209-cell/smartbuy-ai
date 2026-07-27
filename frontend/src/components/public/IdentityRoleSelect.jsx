import { UserRound } from 'lucide-react';

import { IDENTITY_ROLE_OPTIONS } from '../../config/identityRoles';
import useIdentityRole from '../../hooks/useIdentityRole';

export default function IdentityRoleSelect({ className = '' }) {
  const { identityRole, setIdentityRole } = useIdentityRole();

  return (
    <label
      className={`identity-role-select${className ? ` ${className}` : ''}`}
      title="選擇介面身份；正式功能權限仍依登入帳號判定"
    >
      <UserRound size={18} aria-hidden="true" />
      <span className="sr-only">身份</span>
      <select
        value={identityRole}
        onChange={event => setIdentityRole(event.target.value)}
        aria-label="身份選單"
      >
        {IDENTITY_ROLE_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
