/**
 * Build 09 - Modelo de eventos de telemetria (observabilidad != auditoria).
 * AUDIT responde WHO/WHAT/WHEN; TELEMETRY responde HOW (latencia, tasa, estados).
 *
 * REGLA CRITICA: los eventos NO llevan PHI (nada de nombre/email/telefono/direccion,
 * nota clinica, prompt crudo, payload de lab, plan, chunks, credenciales).
 * Solo identificadores de ejecucion + dimensiones seguras.
 */

export type TelemetryEventType =
  | 'ai.execution.started'
  | 'ai.execution.completed'
  | 'ai.execution.abstained'
  | 'ai.execution.denied'
  | 'ai.execution.failed'
  | 'ai.provider_attempt'
  | 'ai.structured_output'
  | 'ai.numeric_contradiction'
  | 'breaker.transition'
  | 'local_auto.selection'
  | 'certification.resolution'
  | 'tool.invocation'
  | 'tool.safety'
  | 'rag.retrieval'
  | 'rag.citation'
  | 'rag.grounding'
  | 'memory.access'
  | 'memory.safety'
  | 'dwh.etl'
  | 'dwh.reconciliation'
  | 'analytics.query'
  | 'shadow.run'
  | 'shadow.review'
  | 'shadow.state_transition'
  | 'shadow.auto_disable';

export const TERMINAL_EVENT_TYPES: readonly TelemetryEventType[] = [
  'ai.execution.completed',
  'ai.execution.abstained',
  'ai.execution.denied',
  'ai.execution.failed',
];

export interface SafeCounts {
  [key: string]: number;
}

export interface TelemetryEvent {
  eventType: TelemetryEventType;
  executionId: string;
  correlationId?: string;
  attemptId?: string;
  toolCallId?: string;
  retrievalId?: string;
  shadowRunId?: number;
  loadRunId?: number;
  capability?: string;
  baseRisk?: string;
  effectiveRisk?: string;
  provider?: string;
  model?: string;
  certificationState?: string;
  status: string;
  reasonCode?: string;
  durationMs?: number;
  counts?: SafeCounts;
  latencyMs?: SafeCounts;
  versionBundle?: string;
  breakerState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  breakerReasonCategory?: string;
}

export const PHI_FIELD_NAMES: readonly string[] = [
  'pacienteId', 'patientId', 'nombres', 'apellidos', 'email', 'phone', 'telefono',
  'direccion', 'address', 'notaClinica', 'clinicalNote', 'prompt', 'fullPrompt',
  'providerRequest', 'providerResponse', 'labPayload', 'mealPlan', 'documentChunks',
  'password', 'apiKey', 'token', 'secret', 'credential', 'resultsJson', 'content',
];

export function containsPhiFieldNames(payload: Record<string, unknown>): string[] {
  return PHI_FIELD_NAMES.filter((name) => Object.prototype.hasOwnProperty.call(payload, name));
}

export function assertNoPhiFields(event: TelemetryEvent): void {
  const found = containsPhiFieldNames(event as unknown as Record<string, unknown>);
  if (found.length > 0) {
    throw new Error(`telemetria rechazada: campos PHI no permitidos: ${found.join(', ')}`);
  }
}

export const STABLE_REASON_CODES: readonly string[] = [
  'MISSING_REQUIRED_DATA',
  'NO_ELIGIBLE_MODEL',
  'GROUNDING_FAILURE',
  'CONTRADICTORY_DATA',
  'MODEL_NOT_CERTIFIED',
  'SAFETY_BLOCK',
  'TOOL_UNAVAILABLE',
  'INSUFFICIENT_EVIDENCE',
  'STALE_REQUIRED_DATA',
  'KILL_SWITCH',
  'CAPABILITY_DENIED',
  'CONSENT_REQUIRED',
  'PROVIDER_TIMEOUT',
  'RATE_LIMIT',
  'CONNECTION_FAILURE',
  'PROVIDER_ERROR',
  'SCHEMA_FAILURE',
  'MODEL_NOT_ELIGIBLE_FOR_SHADOW',
  'INYECTADO',
];