/**
 * Component for role-based conditional rendering.
 */

import { useAuth } from "@/hooks/auth/useAuth";
import { UserRole, hasRole } from "@/types/user";

interface CanProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function Can({ roles, children, fallback = null }: CanProps) {
  const { user } = useAuth();

  if (!hasRole(user, roles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Component to show content only to admin or func users.
 */
export function AdminOnly({
  children,
  fallback,
}: Omit<CanProps, "roles">) {
  return (
    <Can roles={[UserRole.ADMIN, UserRole.FUNC]} fallback={fallback}>
      {children}
    </Can>
  );
}

/**
 * Component to show content only to admin or func users.
 */
export function StaffOnly({
  children,
  fallback,
}: Omit<CanProps, "roles">) {
  return (
    <Can roles={[UserRole.ADMIN, UserRole.FUNC]} fallback={fallback}>
      {children}
    </Can>
  );
}

/**
 * Component to show content only to cliente users.
 */
export function ClienteOnly({
  children,
  fallback,
}: Omit<CanProps, "roles">) {
  return (
    <Can roles={[UserRole.CLIENTE]} fallback={fallback}>
      {children}
    </Can>
  );
}
