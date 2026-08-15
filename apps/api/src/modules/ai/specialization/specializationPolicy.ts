import type { EvidenceSnapshot, EvaluationVerdict, SpecializationCandidate } from './specializationTypes.js';

export function evaluateCandidate(candidate: SpecializationCandidate, evidence: EvidenceSnapshot, now: Date): EvaluationVerdict {
  const reasons: string[] = [];

  for (const criterion of candidate.evidenceCriteria) {
    if (criterion.kind === 'rag_recall') {
      if (evidence.ragRecall === null) {
        reasons.push('sin evidencia de recall RAG');
      } else if (criterion.comparison === 'lt' && !(evidence.ragRecall < criterion.value)) {
        reasons.push(`recall RAG actual (${evidence.ragRecall}) no evidencia insuficiencia (techo ${criterion.value})`);
      } else if (criterion.comparison === 'gt' && !(evidence.ragRecall > criterion.value)) {
        reasons.push(`recall RAG actual (${evidence.ragRecall}) no supera ${criterion.value}`);
      }
    } else if (criterion.kind === 'model_pass_rate') {
      const capability = criterion.capability;
      const rate = capability ? evidence.passRates[capability] ?? null : null;
      if (rate === null) {
        reasons.push(`sin evidencia de pass rate para ${capability ?? 'la capability'}`);
      } else if (criterion.comparison === 'lt' && !(rate < criterion.value)) {
        reasons.push(`pass rate ${capability} (${rate}) no evidencia insuficiencia (techo ${criterion.value})`);
      } else if (criterion.comparison === 'gt' && !(rate > criterion.value)) {
        reasons.push(`pass rate ${capability} (${rate}) no supera ${criterion.value}`);
      }
    } else if (criterion.kind === 'cost_per_completion') {
      if (evidence.costPerCompletion === null) {
        reasons.push('sin evidencia de costo por completion');
      } else if (criterion.comparison === 'gt' && !(evidence.costPerCompletion > criterion.value)) {
        reasons.push(`costo por completion (${evidence.costPerCompletion}) no supera ${criterion.value}`);
      } else if (criterion.comparison === 'lt' && !(evidence.costPerCompletion < criterion.value)) {
        reasons.push(`costo por completion (${evidence.costPerCompletion}) no baja de ${criterion.value}`);
      }
    }
  }

  const governance = candidate.governance;
  if (governance.requiresPHI) {
    if (!governance.legalReview) reasons.push('falta revision legal para PHI');
    if (!governance.privacyReview) reasons.push('falta revision de privacidad para PHI');
    if (!governance.deidentification) reasons.push('falta desidentificacion declarada para PHI');
    if (!governance.professionalApproval) reasons.push('falta aprobacion profesional para PHI');
    if (!governance.retentionDays || governance.retentionDays <= 0) reasons.push('falta politica de retencion para PHI');
  } else if (!governance.professionalApproval) {
    reasons.push('falta aprobacion profesional');
  }

  return {
    candidateId: candidate.id,
    status: reasons.length === 0 ? 'approved' : 'blocked',
    reasons,
    evaluatedAt: now.toISOString(),
  };
}