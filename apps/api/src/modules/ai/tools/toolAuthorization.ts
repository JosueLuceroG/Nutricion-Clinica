import type { Role } from '@nutriclinica/shared';
import type { AIToolDefinition } from './toolDefinition.js';

const ROLE_ORDER: readonly Role[] = ['soporte_tecnico', 'auditor', 'asistente', 'facturacion', 'nutriologa', 'admin'];

function roleIndex(role: Role): number {
  const index = ROLE_ORDER.indexOf(role);
  return index === -1 ? -1 : index;
}

export function roleSatisfies(role: Role, minRole: Role): boolean {
  return roleIndex(role) >= roleIndex(minRole);
}

export interface ToolConsentCheck {
  pacienteId: string;
  checker: (pacienteId: string, sucursalId: string, tipo: string) => Promise<boolean>;
}

export type ToolAuthorization =
  | { allowed: true }
  | { allowed: false; status: number; reason: string };

export async function authorizeTool(
  tool: AIToolDefinition,
  actor: { role: Role; sucursalId: string },
  consent?: ToolConsentCheck,
): Promise<ToolAuthorization> {
  if (!roleSatisfies(actor.role, tool.minRole)) {
    return { allowed: false, status: 403, reason: 'Rol sin permiso para esta herramienta' };
  }

  if (tool.requiredConsent) {
    if (!consent) {
      return { allowed: false, status: 400, reason: 'Se requiere un paciente con consentimiento para esta herramienta' };
    }
    const accepted = await consent.checker(consent.pacienteId, actor.sucursalId, tool.requiredConsent);
    if (!accepted) {
      return { allowed: false, status: 403, reason: `Consentimiento '${tool.requiredConsent}' no otorgado` };
    }
  }

  return { allowed: true };
}