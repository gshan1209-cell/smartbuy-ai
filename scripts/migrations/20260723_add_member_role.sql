-- PR-5: four-role RBAC. Safe to run repeatedly.
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'consumer';

UPDATE members
SET role = 'consumer'
WHERE role IS NULL OR role NOT IN ('consumer', 'farmer', 'merchant', 'admin');

ALTER TABLE members
  DROP CONSTRAINT IF EXISTS members_role_check;

ALTER TABLE members
  ADD CONSTRAINT members_role_check
  CHECK (role IN ('consumer', 'farmer', 'merchant', 'admin'));

-- Optional, manual assignment only; never run with a real email committed here:
-- UPDATE members SET role = 'admin' WHERE email = '<ADMIN_EMAIL>';
