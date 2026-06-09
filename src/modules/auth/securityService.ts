import { useAuthStore } from "@store/authStore";

const PERMISSION_MATRIX: Record<string, string[]> = {
  admin: ["*"],
  nutriologa: [
    "patients",
    "consultations",
    "anthropometry",
    "laboratory",
    "mealplan",
    "recipes",
    "goals",
    "adherence",
    "documents",
    "meal-planner",
    "agenda",
    "reports",
    "medications",
    "dashboard",
  ],
  asistente: [
    "patients:read",
    "consultations:read",
    "anthropometry:read",
    "laboratory:read",
    "agenda",
    "reports:read",
  ],
  soporte_tecnico: ["*:read", "backup", "sync"],
  auditor: ["*:read", "audit"],
  facturacion: ["consultations:read", "billing", "reports:read"],
};

/**
 * Verifica si un rol tiene acceso a un módulo específico.
 * Soporta wildcard `*` (todos los módulos) y `*:read` (solo lectura en todos).
 * @param action - Acción específica (ej. "read", "write"). Opcional.
 */
export function hasModuleAccess(
  module: string,
  role: string,
  action?: string,
): boolean {
  const permissions = PERMISSION_MATRIX[role];
  if (!permissions) return false;
  if (permissions.includes("*")) return true;
  if (permissions.includes(module)) return true;
  if (permissions.includes(`${module}:read`) || permissions.includes("*:read")) return true;
  if (action && permissions.includes(`${module}:${action}`)) return true;
  return false;
}

export function checkPermission(module: string, action: string = "read"): boolean {
  const role = getCurrentRole();
  if (!role) return false;
  return hasModuleAccess(module, role, action);
}

export function canAccessModule(module: string): boolean {
  return checkPermission(module, "read");
}

function getCurrentRole(): string | null {
  try {
    const state = useAuthStore.getState?.();
    return state?.user?.rol ?? null;
  } catch {
    return null;
  }
}
