import { describe, expect, it, vi } from 'vitest';
import type { AICompletionResult } from '../providers/aiProviderAdapter.js';
import { gradeCase, ModelEvaluator } from './modelEvaluator.js';
import { getDatasetFingerprint, NUTRITION_GOLDEN_DATASET } from './nutritionGoldenDataset.js';

function result(content: string): AICompletionResult {
  return { content, model: 'm', finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } };
}

describe('gradeCase', () => {
  it('passes when all required terms are present', () => {
    const { passed, reasons } = gradeCase(NUTRITION_GOLDEN_DATASET[0]!, result('Reducir el consumo de sal y sodio'));
    expect(passed).toBe(true);
    expect(reasons).toEqual([expect.stringContaining('sodio'), expect.stringContaining('sal')]);
  });

  it('fails when a required term is missing', () => {
    const { passed } = gradeCase(NUTRITION_GOLDEN_DATASET[0]!, result('Reducir el sodio'));
    expect(passed).toBe(false);
  });

  it('fails when a forbidden term appears', () => {
    const g007 = NUTRITION_GOLDEN_DATASET.find((c) => c.id === 'G007')!;
    expect(gradeCase(g007, result('Tomar 500 mg al dia')).passed).toBe(false);
    expect(gradeCase(g007, result('No debe indicar dosis; consulte a su medico')).passed).toBe(true);
  });

  it('passes abstention cases only when no digits are invented', () => {
    const g002 = NUTRITION_GOLDEN_DATASET.find((c) => c.id === 'G002')!;
    expect(gradeCase(g002, result('No cuento con esos datos, consulte a su nutriologo')).passed).toBe(true);
    expect(gradeCase(g002, result('Necesita 1800 kcal')).passed).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(gradeCase(NUTRITION_GOLDEN_DATASET[0]!, result('SAL Y SODIO')).passed).toBe(true);
  });
});

describe('ModelEvaluator', () => {
  it('runs every case and reports metrics', async () => {
    const evaluator = new ModelEvaluator({ run: async () => result('respuesta') });
    const report = await evaluator.evaluate('openai/gpt-4o-mini', 'gpt-4o-mini-2024-07-18');

    expect(report.totalCases).toBe(NUTRITION_GOLDEN_DATASET.length);
    expect(report.verdicts).toHaveLength(report.totalCases);
    expect(report.passed + report.failed).toBe(report.totalCases);
    expect(report.passRate).toBeGreaterThanOrEqual(0);
    expect(report.datasetFingerprint).toBe(getDatasetFingerprint());
    expect(report.modelKey).toBe('openai/gpt-4o-mini');
    expect(report.modelVersion).toBe('gpt-4o-mini-2024-07-18');
  });

  it('grades each case through the runner output', async () => {
    const evaluator = new ModelEvaluator({
      run: async (request) => {
        const g002 = NUTRITION_GOLDEN_DATASET.find((c) => c.id === 'G002')!;
        if (request.userPrompt === g002.scenario) return result('No puedo calcular sin datos');
        return result('agua fibra sal sodio');
      },
    });
    const report = await evaluator.evaluate('ollama/llama3.2', '3.2');
    expect(report.verdicts.find((v) => v.caseId === 'G002')?.passed).toBe(true);
    expect(report.failed).toBeGreaterThan(0);
  });

  it('passes the golden dataset fully with a compliant runner', async () => {
    const evaluator = new ModelEvaluator({
      run: async (request) => {
        const aiCase = NUTRITION_GOLDEN_DATASET.find((c) => c.scenario === request.userPrompt);
        if (!aiCase) return result('no');
        if (aiCase.expected.requiresAbstention) return result('No tengo datos suficientes para responder.');
        return result([...aiCase.expected.mustInclude, 'recomendacion general'].join(' '));
      },
    });
    const report = await evaluator.evaluate('ollama/llama3.2', '3.2');
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.totalCases);
  });

  it('injects a real gateway-backed runner', async () => {
    const runner = vi.fn(async () => result('agua fibra'));
    const evaluator = new ModelEvaluator({ run: runner });
    await evaluator.evaluate('ollama/llama3.2', '3.2');
    expect(runner).toHaveBeenCalledTimes(NUTRITION_GOLDEN_DATASET.length);
  });
});
