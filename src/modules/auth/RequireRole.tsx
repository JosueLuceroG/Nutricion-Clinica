import type { ReactNode } from "react";
import type { Role } from "@nutriclinica/shared";
import { useAuthStore } from "@store/authStore";
import { hasAnyRole } from "./authRoles";

export interface RequireRoleProps {
  roles: readonly Role[];
  /** A dónde redirigir si el rol no es válido. Default: '/'. */
  redirectTo?: string;
  /** Contenido alternativo si el usuario está autenticado pero sin el rol. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Route guard: solo renderiza `children` si el usuario actual tiene alguno
 * de los `roles` permitidos. Si no, redirige a `redirectTo` o muestra
 * `fallback` si se proporciona.
 *
 * Usar en componentes top-level de páginas (no en layout) para que el
 * router pueda navegar al redirect.
 */
export const RequireRole = ({
  roles,
  redirectTo = "/",
  fallback,
  children,
}: RequireRoleProps): ReactNode => {
  const user = useAuthStore((s) => s.user);
  if (!user) {
    if (typeof window !== "undefined") {
      window.location.replace(redirectTo);
    }
    return null;
  }
  if (!hasAnyRole(user.rol, roles)) {
    return fallback ?? null;
  }
  return <>{children}</>;
};
