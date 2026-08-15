import type { SpecializationCandidate } from './specializationTypes.js';

export const DEFAULT_SPECIALIZATION_CANDIDATES: readonly SpecializationCandidate[] = [
  {
    id: 'nutrition_fine_tuning',
    name: 'Fine-tuning del modelo de nutricion',
    description: 'Especializacion del modelo para razonamiento nutricional. Requiere evidencia de insuficiencia de RAG/tools/prompts y gobierno PHI completo.',
    kind: 'fine_tuning',
    dataSource: 'phi',
    governance: {
      requiresPHI: true,
      legalReview: false,
      privacyReview: false,
      deidentification: false,
      retentionDays: null,
      professionalApproval: false,
    },
    evidenceCriteria: [
      { kind: 'rag_recall', comparison: 'lt', value: 0.6 },
      { kind: 'model_pass_rate', comparison: 'lt', value: 0.85, capability: 'nutrition_reasoning' },
      { kind: 'cost_per_completion', comparison: 'gt', value: 0.01 },
    ],
  },
  {
    id: 'dietitian_lora',
    name: 'LoRA para estilos de respuesta dietetica',
    description: 'Adaptador ligero sobre el modelo base. No requiere PHI; exige aprobacion profesional y evidencia de pass rate insuficiente.',
    kind: 'lora',
    dataSource: 'synthetic',
    governance: {
      requiresPHI: false,
      legalReview: false,
      privacyReview: false,
      deidentification: false,
      retentionDays: null,
      professionalApproval: false,
    },
    evidenceCriteria: [
      { kind: 'model_pass_rate', comparison: 'lt', value: 0.9, capability: 'nutrition_reasoning' },
    ],
  },
  {
    id: 'adherence_predictive_model',
    name: 'Modelo predictivo de adherencia',
    description: 'Analitica predictiva sobre adherencia. Requiere evidencia de insuficiencia de los validadores deterministas y gobierno PHI completo.',
    kind: 'predictive_analytics',
    dataSource: 'deidentified_clinic',
    governance: {
      requiresPHI: true,
      legalReview: false,
      privacyReview: false,
      deidentification: false,
      retentionDays: null,
      professionalApproval: false,
    },
    evidenceCriteria: [
      { kind: 'rag_recall', comparison: 'lt', value: 0.6 },
      { kind: 'model_pass_rate', comparison: 'lt', value: 0.85, capability: 'nutrition_reasoning' },
    ],
  },
];

export function defaultSpecializationCandidates(): SpecializationCandidate[] {
  return DEFAULT_SPECIALIZATION_CANDIDATES.map((candidate) => ({ ...candidate, governance: { ...candidate.governance }, evidenceCriteria: [...candidate.evidenceCriteria] }));
}