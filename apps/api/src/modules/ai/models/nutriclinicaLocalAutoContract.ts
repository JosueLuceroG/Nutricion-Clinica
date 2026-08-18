/**
 * CONTRATO NUTRICLINICA_LOCAL_AUTO (Build 07, preparado - NO implementado).
 *
 * Objetivo de Build 07.5: seleccionar automaticamente el modelo local (ollama)
 * como proveedor por defecto SOLO cuando la certificacion clínica lo permita.
 * Este contrato fija los invariantes; la seleccion del modelo se decide en 07.5.
 */

export const ROUTING_CONTRACT_VERSION = 'routing-contract.v1';

export type RoutingMode = 'NUTRICLINICA_LOCAL_AUTO' | 'MANUAL_PROVIDER';

export interface RoutingContract {
  version: string;
  /** El modo es SOLO una preferencia de enrutamiento; nunca desbloquea capacidades. */
  mode: RoutingMode;
  /** Modelos candidatos locales: solo informativo; la seleccion ocurre en 07.5. */
  localCandidates: readonly string[];
}

export const NUTRICLINICA_LOCAL_AUTO_CONTRACT: RoutingContract = {
  version: ROUTING_CONTRACT_VERSION,
  mode: 'NUTRICLINICA_LOCAL_AUTO',
  localCandidates: ['llama3.2'],
};

/** Invariantes que un router 07.5 DEBE respetar (verificables por test). */
export const ROUTING_INVARIANTS: readonly string[] = [
  'preferred_model_hint nunca modifica permisos, riesgo, consenso ni certificación',
  'NUTRICLINICA_LOCAL_AUTO no puede activar APPROVED_PATIENT ni capacidades sin certificación',
  'la seleccion del modelo local se hace por certificación exacta, no por preferencia',
  'sin credenciales locales validas y certificadas, el modo cae a no-disponible (fail-closed)',
  'egress nunca se desactiva por preferencia del usuario',
];

/** Aplica el contrato a un pedido: devuelve el hint de routing sin desbloquear nada. */
export function applyRoutingContract(input: { mode: RoutingMode; preferredModelHint?: string }): {
  mode: RoutingMode;
  preferredModelHint: string | null;
  unlocksCapabilities: false;
} {
  return {
    mode: input.mode,
    preferredModelHint: input.preferredModelHint?.trim() || null,
    unlocksCapabilities: false,
  };
}

/**
 * Decide disponibilidad (07.5): un modo auto SIN candidatos certificados es
 * NO_AVAILABLE. Hoy el contrato solo declara la regla.
 */
export function resolveRoutingAvailability(input: { mode: RoutingMode; certifiedLocalModelCount: number; apiCredentialAvailable: boolean }): 'AVAILABLE' | 'NO_AVAILABLE' | 'FALLBACK' {
  if (input.mode === 'MANUAL_PROVIDER') return input.apiCredentialAvailable ? 'AVAILABLE' : 'NO_AVAILABLE';
  if (input.certifiedLocalModelCount > 0) return 'AVAILABLE';
  return input.apiCredentialAvailable ? 'FALLBACK' : 'NO_AVAILABLE';
}