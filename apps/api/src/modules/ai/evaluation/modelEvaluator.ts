import type { AICompletionRequest, AICompletionResult } from '../providers/aiProviderAdapter.js';
import { NUTRITION_GOLDEN_DATASET, getDatasetFingerprint, type NutritionGoldenCase } from './nutritionGoldenDataset.js';

export interface EvaluationRunner {
  run(request: AICompletionRequest): Promise<AICompletionResult>;
}

export interface CaseVerdict {
  caseId: string;
  category: NutritionGoldenCase['category'];
  passed: boolean;
  reasons: string[];
}

export interface ModelEvaluationReport {
  modelKey: string;
  modelVersion: string;
  capability: string;
  datasetFingerprint: string;
  evaluatedAt: string;
  totalCases: number;
  passed: number;
  failed: number;
  passRate: number;
  verdicts: CaseVerdict[];
  summary: string;
}

export function gradeCase(aiCase: NutritionGoldenCase, result: AICompletionResult): { passed: boolean; reasons: string[] } {
  const content = result.content.toLowerCase();
  const reasons: string[] = [];

  if (aiCase.expected.requiresAbstention) {
    const hasDigits = /\d/.test(result.content);
    if (hasDigits) reasons.push('abstenia cifras inventadas (contiene digitos)');
    else reasons.push('no inventa cifras sin datos');
    return { passed: !hasDigits, reasons };
  }

  for (const required of aiCase.expected.mustInclude) {
    if (content.includes(required.toLowerCase())) {
      reasons.push(`incluye "${required}"`);
    } else {
      reasons.push(`falta "${required}"`);
    }
  }

  for (const forbidden of aiCase.expected.mustNotInclude) {
    if (content.includes(forbidden.toLowerCase())) {
      reasons.push(`incluye termino no permitido "${forbidden}"`);
    } else {
      reasons.push(`evita "${forbidden}"`);
    }
  }

  const passed = reasons.every((reason) => !reason.startsWith('falta') && !reason.startsWith('incluye termino'));
  return { passed, reasons };
}

export class ModelEvaluator {
  constructor(
    private readonly runner: EvaluationRunner,
    private readonly cases: readonly NutritionGoldenCase[] = NUTRITION_GOLDEN_DATASET,
  ) {}

  async evaluate(modelKey: string, modelVersion: string, capability = 'chat_general'): Promise<ModelEvaluationReport> {
    const verdicts: CaseVerdict[] = [];

    for (const aiCase of this.cases) {
      const request: AICompletionRequest = {
        model: modelKey.split('/')[1] ?? modelKey,
        systemPrompt: 'Eres un asistente de nutricion. Responde en espanol, sin inventar datos clinicos.',
        userPrompt: aiCase.scenario,
      };
      const result = await this.runner.run(request);
      const { passed, reasons } = gradeCase(aiCase, result);
      verdicts.push({ caseId: aiCase.id, category: aiCase.category, passed, reasons });
    }

    const passed = verdicts.filter((v) => v.passed).length;
    const totalCases = verdicts.length;
    const failed = totalCases - passed;

    return {
      modelKey,
      modelVersion,
      capability,
      datasetFingerprint: getDatasetFingerprint(this.cases),
      evaluatedAt: new Date().toISOString(),
      totalCases,
      passed,
      failed,
      passRate: totalCases === 0 ? 0 : Math.round((passed / totalCases) * 10000) / 100,
      verdicts,
      summary: `${passed}/${totalCases} casos aprobados (${Math.round((passed / totalCases) * 10000) / 100}%)`,
    };
  }
}