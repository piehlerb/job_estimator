import { useAuth } from '../contexts/AuthContext';
import { canWrite, type PermissionArea } from '../lib/permissions';

/**
 * Whether the signed-in member may change things in an area. Pages that are
 * visible at View level use this to hide or disable every editing control.
 * Personal (org-less) accounts can always edit.
 */
export function useCanEdit(area: PermissionArea): boolean {
  const { organization, permissions } = useAuth();
  return !organization || canWrite(permissions, area);
}
