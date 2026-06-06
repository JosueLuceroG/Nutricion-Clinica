import type { Role } from "@nutriclinica/shared";
import { useAuthStore } from "@store/authStore";

/**
 * Roles con acceso al módulo de Facturación (Sprint 14D).
 * Por RN-ECO-06 estricto: solo admin y facturacion.
 * Asistente también (típico: registra pagos reportados).
 */
export const BILLING_ROLES: readonly Role[] = ["admin", "facturacion", "asistente"] as const;

/**
 * Roles con acceso a lectura del reporte financiero.
 * (admin + facturacion; asistente no — solo registra pagos).
 */
export const BILLING_REPORT_ROLES: readonly Role[] = ["admin", "facturacion"] as const;

export const isBillingRole = (role: Role | null | undefined): boolean =>
  !!role && (BILLING_ROLES as readonly string[]).includes(role);

export const isBillingReportRole = (role: Role | null | undefined): boolean =>
  !!role && (BILLING_REPORT_ROLES as readonly string[]).includes(role);

/**
 * Hook para acceder al rol del usuario actual.
 * Devuelve `null` si no hay sesión.
 */
export const useCurrentRole = (): Role | null => {
  return useAuthStore((s) => s.user?.rol ?? null);
};

export const hasAnyRole = (
  userRole: Role | null | undefined,
  allowed: readonly Role[],
): boolean => !!userRole && (allowed as readonly string[]).includes(userRole);
