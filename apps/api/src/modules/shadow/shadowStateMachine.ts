/**
 * Build 09 - Shadow clinical validation (READINESS; NUNCA produccion clinica).
 *
 * Estados controlados POR EL SERVIDOR (transiciones auditadas), nunca por el usuario:
 *   DISABLED (default, AI_SHADOW_STATE)
 *   TECHNICAL_TEST_ONLY (falso deterministico; ningun modelo real puede activarlo)
 *   READY_FOR_PROFESSIONAL_SHADOW
 *   ACTIVE_PROFESSIONAL_SHADOW
 *   PAUSED (transitorio operativo; se registra la causa)
 *   AUTO_DISABLED (solo transicion automatica; nunca se revierte solo)
 *   COMPLETED (final; no se reactiva)
 *
 * REGLAS DURAS:
 * - El output del shadow NUNCA llega al paciente, nunca modifica plan/diagnostico/nota,
 *   nunca envia mensajes, nunca programa acciones, nunca persiste verdad clinica,
 *   nunca dispara acciones confirmadas, no hay cadenas autonomas de agentes.
 * - El feedback del shadow NUNCA es dato de entrenamiento automatico.
 * - Un modelo fallido/bloqueado/obsoleto NO puede entrar al shadow profesional.
 */
export type ShadowState =
  | 'DISABLED'
  | 'TECHNICAL_TEST_ONLY'
  | 'READY_FOR_PROFESSIONAL_SHADOW'
  | 'ACTIVE_PROFESSIONAL_SHADOW'
  | 'PAUSED'
  | 'AUTO_DISABLED'
  | 'COMPLETED';

export type ShadowTransitionKind = 'manual' | 'auto' | 'system';

export interface ShadowStateTransition {
  from: ShadowState | null;
  to: ShadowState;
  kind: ShadowTransitionKind;
  changedBy: string;
  reason: string;
  auditJson?: string;
}

const ALLOWED_MANUAL: ReadonlyArray<readonly [ShadowState, ShadowState]> = [
  ['DISABLED', 'TECHNICAL_TEST_ONLY'],
  ['TECHNICAL_TEST_ONLY', 'DISABLED'],
  ['TECHNICAL_TEST_ONLY', 'READY_FOR_PROFESSIONAL_SHADOW'],
  ['READY_FOR_PROFESSIONAL_SHADOW', 'ACTIVE_PROFESSIONAL_SHADOW'],
  ['ACTIVE_PROFESSIONAL_SHADOW', 'PAUSED'],
  ['PAUSED', 'ACTIVE_PROFESSIONAL_SHADOW'],
  ['PAUSED', 'DISABLED'],
  ['ACTIVE_PROFESSIONAL_SHADOW', 'COMPLETED'],
  ['READY_FOR_PROFESSIONAL_SHADOW', 'DISABLED'],
];

const AUTO_DISABLE_FROM: readonly ShadowState[] = [
  'READY_FOR_PROFESSIONAL_SHADOW',
  'ACTIVE_PROFESSIONAL_SHADOW',
  'PAUSED',
];

export function canTransition(from: ShadowState | null, to: ShadowState, kind: ShadowTransitionKind): { allowed: boolean; reason?: string } {
  if (to === 'AUTO_DISABLED') {
    if (kind !== 'auto') return { allowed: false, reason: 'AUTO_DISABLED solo por transicion automatica' };
    if (from === null || !AUTO_DISABLE_FROM.includes(from)) return { allowed: false, reason: `AUTO_DISABLED no permitido desde ${from ?? 'null'}` };
    return { allowed: true };
  }
  if (to === 'COMPLETED') {
    if (kind !== 'manual') return { allowed: false, reason: 'COMPLETED es una transicion manual final' };
    if (from !== 'ACTIVE_PROFESSIONAL_SHADOW') return { allowed: false, reason: 'COMPLETED solo desde ACTIVE_PROFESSIONAL_SHADOW' };
    return { allowed: true };
  }
  if (kind !== 'manual') return { allowed: false, reason: `${to} solo por transicion manual` };
  if (from === null) {
    return to === 'DISABLED'
      ? { allowed: true }
      : { allowed: false, reason: 'estado inicial permitido: DISABLED' };
  }
  const ok = ALLOWED_MANUAL.some(([f, t]) => f === from && t === to);
  return ok ? { allowed: true } : { allowed: false, reason: `transicion manual no permitida: ${from} -> ${to}` };
}

export function isManualFromTo(from: ShadowState, to: ShadowState): boolean {
  return ALLOWED_MANUAL.some(([f, t]) => f === from && t === to);
}

export const INITIAL_SHADOW_STATE: ShadowState = 'DISABLED';
export const SHADOW_STATES: readonly ShadowState[] = [
  'DISABLED', 'TECHNICAL_TEST_ONLY', 'READY_FOR_PROFESSIONAL_SHADOW',
  'ACTIVE_PROFESSIONAL_SHADOW', 'PAUSED', 'AUTO_DISABLED', 'COMPLETED',
];