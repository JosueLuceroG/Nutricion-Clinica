import type { ReactNode } from "react";
import type { Role } from "@nutriclinica/shared";
import { useAuthStore } from "@store/authStore";
import { hasAnyRole } from "./authRoles";

export interface RequireRoleProps {
  /**
   * Roles permitidos para acceder al contenido.
   */
  roles?: readonly Role[];
  /**
   * Roles permitidos. Si es undefined, cualquier usuario autenticado puede acceder.
   */
  allowedRoles?: readonly Role[];
  /**
   * A dónde redirigir si no está autenticado. Default: '/login'.
   */
  redirectTo?: string;
  /** Contenido alternativo si el usuario está autenticado pero sin el rol. */
  fallback?: ReactNode;
  children: ReactNode;
}

export const RequireRole = ({
  roles,
  allowedRoles,
  redirectTo = "/login",
  fallback,
  children,
}: RequireRoleProps): ReactNode => {
  const user = useAuthStore((s) => s.user);
  const effectiveRoles = allowedRoles ?? roles;

  if (!user) {
    if (typeof window !== "undefined") {
      window.location.replace(redirectTo);
    }
    return null;
  }

  if (effectiveRoles && !hasAnyRole(user.rol, effectiveRoles)) {
    return fallback ?? null;
  }

  return <>{children}</>;
};
