/**
 * Control de acceso a telemetria (Build 09 §28).
 * Roles permitidos: admin, auditor, soporte_tecnico, y rol de gobierno clinico
 * autorizado (si existe). Un paciente normal: NUNCA. Un profesional normal:
 * NO accede a telemetria de toda la organizacion.
 */
export const TELEMETRY_ROLES = ['admin', 'auditor', 'soporte_tecnico'] as const;
export type TelemetryRole = (typeof TELEMETRY_ROLES)[number];

export function canAccessTelemetry(rol: string): boolean {
  return (TELEMETRY_ROLES as readonly string[]).includes(rol);
}

export function requireTelemetryRole(rol: string): void {
  if (!canAccessTelemetry(rol)) {
    const err = new Error('no autorizado para telemetria') as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}