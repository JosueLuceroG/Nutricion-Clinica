import type { PatientContext } from './contextBuilder.js';
import type { SafetyReport } from './safetyEngine.js';

export type AbstentionKind = 'missing_data' | 'safety' | 'unverifiable' | 'knowledge_unavailable' | 'ungrounded';

export interface AbstentionDecision {
  abstain: boolean;
  kind?: AbstentionKind;
  reason?: string;
}

export function decideAbstention(input: {
  ctx: PatientContext;
  safety: SafetyReport;
  hasCalculators: boolean;
  hasPlanTargets: boolean;
}): AbstentionDecision {
  if (input.safety.hasBlocker) {
    return {
      abstain: true,
      kind: 'safety',
      reason: input.safety.flags.find((f) => f.severity === 'blocker')?.message ?? 'Banderas de seguridad bloqueantes',
    };
  }
  if (input.ctx.profileMissing) {
    return { abstain: true, kind: 'missing_data', reason: 'Sin datos del paciente: no se puede generar consejo' };
  }
  if (!input.hasCalculators && !input.hasPlanTargets) {
    return {
      abstain: true,
      kind: 'missing_data',
      reason: 'Faltan peso y talla recientes: no se pueden estimar requerimientos caloricos',
    };
  }
  return { abstain: false };
}