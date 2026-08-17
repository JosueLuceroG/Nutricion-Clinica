import { describe, expect, it, vi } from 'vitest';
import type { GatewayResult } from '../aiOrchestrator.js';
import type { AICompletionRequest } from '../providers/aiProviderAdapter.js';
import { defineTool } from '../tools/toolDefinition.js';
import { AIToolRegistry } from '../tools/toolRegistry.js';
import { ToolExecutionService } from '../tools/toolExecutionService.js';
import { NutritionCapabilityService, capabilityCatalogSummary } from './nutritionCapabilityService.js';
import { NUTRITION_CAPABILITY_CATALOG } from './nutritionCapabilityRegistry.js';

const PATIENT = '00000000-0000-4000-8000-000000000001';
const SUCURSAL = '00000000-0000-4000-8000-000000000002';
const ACTOR = { profesionalId: '00000000-0000-4000-8000-000000000003', role: 'nutriologa' as const };

const TOOL_IDS = NUTRITION_CAPABILITY_CATALOG.flatMap((e) => e.tools);

async function makeService(overrides: { tools?: Record<string, unknown>; completeAi?: (req: AICompletionRequest) => Promise<GatewayResult>; retrieveKnowledge?: (query: string) => Promise<never[]>; now?: Date; audit?: (event: unknown) => void } = {}) {
  const { z } = await import('zod');
  const tools = TOOL_IDS.map((id) => {
    const data = overrides.tools?.[id] ?? null;
    return defineTool({
      id,
      name: id,
      description: id,
      readOnly: true,
      riskLevel: 'high',
      dataCategories: ['clinical'],
      requiredConsent: 'ai_opt_in',
      minRole: 'nutriologa',
      maxAgeMs: 60_000,
      schema: { pacienteId: z.string().uuid({ message: 'pacienteId' }) },
      execute: async () => data,
    });
  });
  const registry = new AIToolRegistry();
  for (const tool of tools) registry.register(tool);
  const env = { AI_TOOLS_ENABLED: 'true', AI_TOOLS_ALLOWLIST: TOOL_IDS.join(',') } as NodeJS.ProcessEnv;
  const toolService = new ToolExecutionService(registry, { env });
  const completeAi = overrides.completeAi ?? vi.fn(async (): Promise<GatewayResult> => ({
    ok: true,
    provider: 'fake',
    model: 'fake-model',
    result: { content: 'Resumen educativo basado en los hechos.', model: 'fake-model', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, finishReason: 'stop' },
    attempts: [],
    executionId: 'e1',
    correlationId: 'c1',
  }));
  const service = new NutritionCapabilityService({
    env,
    consent: { pacienteId: PATIENT, checker: async () => true },
    toolService,
    completeAi,
    audit: overrides.audit,
    now: overrides.now ?? new Date('2026-08-17T00:00:00.000Z'),
    retrieveKnowledge: overrides.retrieveKnowledge as never,
  });
  return { service, completeAi };
}

const REQUEST = (capabilityId: string, input?: Record<string, unknown>) => ({ capabilityId, pacienteId: PATIENT, sucursalId: SUCURSAL, actor: ACTOR, input });

describe('Nutrition capability catalog', () => {
  it('define las 21 capacidades canonicas con estados honestos', () => {
    expect(NUTRITION_CAPABILITY_CATALOG.length).toBe(21);
    const summary = capabilityCatalogSummary();
    expect(summary.total).toBe(21);
    expect(summary.implemented).toBe(19);
    expect(summary.partial).toBe(1);
    expect(summary.blocked).toBe(1);
  });

  it('analyzeNutritionGoals es BLOCKED con motivo de fuente autoritativa', () => {
    const entry = NUTRITION_CAPABILITY_CATALOG.find((e) => e.capabilityId === 'analyzeNutritionGoals')!;
    expect(entry.status).toBe('BLOCKED');
    expect(entry.blockedReason).toMatch(/BLOCKED/);
  });

  it('reviewDrugNutrientInteractions es PARTIAL con alcance documentado', () => {
    const entry = NUTRITION_CAPABILITY_CATALOG.find((e) => e.capabilityId === 'reviewDrugNutrientInteractions')!;
    expect(entry.status).toBe('PARTIAL');
    expect(entry.notes).toMatch(/reglas documentadas/);
  });

  it('validateMealPlan y detectNutritionDataGaps son deterministicOnly (sin LLM)', () => {
    const validate = NUTRITION_CAPABILITY_CATALOG.find((e) => e.capabilityId === 'validateMealPlan')!;
    const gaps = NUTRITION_CAPABILITY_CATALOG.find((e) => e.capabilityId === 'detectNutritionDataGaps')!;
    expect(validate.deterministicOnly).toBe(true);
    expect(validate.llmStage).toBe(false);
    expect(gaps.deterministicOnly).toBe(true);
  });
});

describe('Nutrition capability service', () => {
  it('capacidad desconocida → FAILED (fail-closed)', async () => {
    const { service } = await makeService();
    const result = await service.executeCapability(REQUEST('no_existe'));
    expect(result.status).toBe('FAILED');
    expect(result.abstentionReason).toMatch(/[Dd]esconocida/);
  });

  it('capacidad BLOCKED → BLOCKED sin invocar herramientas', async () => {
    const { service } = await makeService();
    const result = await service.executeCapability(REQUEST('analyzeNutritionGoals'));
    expect(result.status).toBe('BLOCKED');
    expect(result.blockedReason).toMatch(/BLOCKED/);
    expect(result.payload).toEqual({});
  });

  it('herramientas deshabilitadas → FAILED', async () => {
    const { z } = await import('zod');
    const registry = new AIToolRegistry();
    registry.register(defineTool({ id: 'x', name: 'x', description: 'x', readOnly: true, riskLevel: 'low', dataCategories: ['clinical'], minRole: 'nutriologa', maxAgeMs: 1000, schema: { pacienteId: z.string().uuid() }, execute: async () => null }));
    const disabledService = new NutritionCapabilityService({
      env: { AI_TOOLS_ENABLED: 'false' } as NodeJS.ProcessEnv,
      consent: { pacienteId: PATIENT, checker: async () => true },
      toolService: new ToolExecutionService(registry, { env: { AI_TOOLS_ENABLED: 'false' } as NodeJS.ProcessEnv }),
      now: new Date('2026-08-17T00:00:00.000Z'),
    });
    const result = await disabledService.executeCapability(REQUEST('validateMealPlan', { planItems: [] }));
    expect(result.status).toBe('FAILED');
    expect(result.abstentionReason).toMatch(/deshabilitadas/);
  });

  it('validateMealPlan: determinista sin LLM, valida equivalentes SMAE', async () => {
    const { service, completeAi } = await makeService({ tools: { get_diet: { meals_json: [{ foodId: 'cereal-tortilla-maiz', group: 'cereales-sin-grasa', portions: 4 }, { group: 'aoa-bajo', portions: 2 }], kcal_target: 390, protein_target_g: 22, carbs_target_g: 60, fat_target_g: 5 }, get_allergies: [], get_intolerances: [] } });
    const result = await service.executeCapability(REQUEST('validateMealPlan'));
    expect(result.status).toBe('SUCCESS');
    expect(result.aiContent).toBeUndefined();
    const payload = result.payload as { validation: { ok: boolean; summary: { totals: { kcal: number } } } };
    expect(payload.validation.ok).toBe(true);
    expect(payload.validation.summary.totals.kcal).toBe(390);
    expect(result.reviewRequired).toBe(true);
    expect(completeAi).not.toHaveBeenCalled();
  });

  it('validateMealPlan: bloquea ítems con alergenos registrados (determinista)', async () => {
    const { service } = await makeService({ tools: { get_diet: { meals_json: [{ foodName: 'Tortilla de maíz', group: 'cereales-sin-grasa', portions: 2 }, { foodName: 'Leche entera', group: 'leche-entera', portions: 1 }], kcal_target: 1000, protein_target_g: 50, carbs_target_g: 100, fat_target_g: 30 }, get_allergies: [{ sustancia: 'lactosa', severidad: 'severa' }], get_intolerancias: [] } });
    const result = await service.executeCapability(REQUEST('validateMealPlan'));
    expect(result.status).toBe('SUCCESS');
    const payload = result.payload as { allergenBlockedItems: string[] };
    expect(payload.allergenBlockedItems).toContain('Leche entera');
    expect(result.risk.effectiveRisk).toBe('RISK_5');
    expect(result.reviewRequired).toBe(true);
  });

  it('suggestFoodSubstitutions: candidatos del mismo grupo sin alergenos', async () => {
    const { service, completeAi } = await makeService({ tools: { get_allergies: [{ sustancia: 'lactosa', severidad: 'moderada' }], get_intolerancias: [] } });
    const result = await service.executeCapability(REQUEST('suggestFoodSubstitutions', { foodId: 'leche-entera' }));
    expect(result.status).toBe('SUCCESS');
    expect(completeAi).not.toHaveBeenCalled();
    const candidates = (result.payload.candidates as Array<{ name: string; group: string }>).map((c) => c.name);
    expect(candidates.every((name) => !/lactosa|leche/i.test(name))).toBe(true);
    expect(result.payload.unmatched).toBe(false);
  });

  it('suggestFoodSubstitutions: alimento fuera del catálogo → unmatched', async () => {
    const { service } = await makeService({ tools: { get_allergies: [], get_intolerancias: [] } });
    const result = await service.executeCapability(REQUEST('suggestFoodSubstitutions', { foodId: 'custom-xyz' }));
    expect(result.status).toBe('SUCCESS');
    expect(result.payload.unmatched).toBe(true);
    expect(result.payload.candidates).toHaveLength(0);
  });

  it('reviewDrugNutrientInteractions: detecta warfarina + vitamina K (severa) y marca NO_COVERED', async () => {
    const { service, completeAi } = await makeService({ tools: { get_medications: [{ id: 'm1', nombre: 'Coumadin', principio_activo: 'Warfarina sódica' }, { id: 'm2', nombre: 'Omeprazol', principio_activo: 'Omeprazol' }] } });
    const result = await service.executeCapability(REQUEST('reviewDrugNutrientInteractions'));
    expect(result.status).toBe('SUCCESS');
    expect(completeAi).not.toHaveBeenCalled();
    const payload = result.payload as { alerts: Array<{ nutriente: string; severidad: string }>; uncoveredMedications: string[]; ruleVersion: string };
    expect(payload.alerts.some((a) => a.nutriente === 'vitamina K' && a.severidad === 'severa')).toBe(true);
    expect(payload.uncoveredMedications).toContain('Omeprazol');
    expect(payload.ruleVersion).toBe('drug-nutrient.v1');
    expect(result.facts.some((f) => f.claimType === 'RULE_RESULT')).toBe(true);
  });

  it('detectNutritionDataGaps: reporta brechas deterministas', async () => {
    const { service, completeAi } = await makeService({ tools: { patient_profile: { nombres: 'Ana' }, anthropometry_tool: null, lab_results: [], meal_plan: null, adherence_summary: [], get_allergies: [] } });
    const result = await service.executeCapability(REQUEST('detectNutritionDataGaps'));
    expect(result.status).toBe('SUCCESS');
    expect(completeAi).not.toHaveBeenCalled();
    const gaps = result.payload.gaps as Array<{ field: string }>;
    expect(gaps.map((g) => g.field)).toEqual(expect.arrayContaining(['antropometría reciente', 'laboratorios recientes']));
  });

  it('analyzeAnthropometry: calcula IMC y abstiene si la salida inventa números', async () => {
    const fakeAi = vi.fn(async (): Promise<GatewayResult> => ({
      ok: true,
      provider: 'fake',
      model: 'fake-model',
      result: { content: 'IMC 99.9 kg/m2 y 500 kcal', model: 'fake-model', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, finishReason: 'stop' },
      attempts: [],
      executionId: 'e1',
      correlationId: 'c1',
    }));
    const { service } = await makeService({ tools: { anthropometry_tool: { weightKg: 70, heightM: 1.75, measuredAt: '2026-08-01T00:00:00.000Z' }, get_evolution: { series: [{ measuredAt: '2026-07-01', weightKg: 71, bmi: 23.2 }], deltas: null } }, completeAi: fakeAi });
    const result = await service.executeCapability(REQUEST('analyzeAnthropometry'));
    expect(result.status).toBe('ABSTAINED');
    expect(result.abstentionReason).toMatch(/numeros sin respaldo/);
    const facts = result.facts.map((f) => f.text).join(' ');
    expect(facts).toMatch(/Indice de masa corporal: 22.9/);
  });

  it('prepareNutritionConsultation: etapa AI exitosa con revisión profesional', async () => {
    const fakeAi = vi.fn(async (): Promise<GatewayResult> => ({
      ok: true,
      provider: 'fake',
      model: 'fake-model',
      result: { content: 'Paciente con 1 consulta reciente y 2 laboratorios.', model: 'fake-model', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, finishReason: 'stop' },
      attempts: [],
      executionId: 'e1',
      correlationId: 'c1',
    }));
    const { service } = await makeService({
      tools: {
        patient_profile: { nombres: 'Ana', fecha_nacimiento: '1990-01-01' },
        anthropometry_tool: { weightKg: 70, heightM: 1.75, measuredAt: '2026-08-01' },
        recent_consultations: [{ id: 'c1' }],
        lab_results: [{ id: 'l1' }, { id: 'l2' }],
        meal_plan: { name: 'Plan A', kcal_target: 1800 },
        adherence_summary: [{ record_date: '2026-08-10' }],
        get_medications: [],
        get_allergies: [],
        get_intolerancias: [],
        get_diagnoses: [],
        get_patient_metrics: { consultationsTotal: 3 },
      },
      completeAi: fakeAi,
    });
    const result = await service.executeCapability(REQUEST('prepareNutritionConsultation'));
    expect(result.status).toBe('SUCCESS');
    expect(result.aiContent).toMatch(/consultas?/);
    expect(result.aiEvidence).toEqual({ provider: 'fake', model: 'fake-model' });
    expect(result.reviewRequired).toBe(true);
    expect(result.risk.baseRisk).toBe('RISK_3');
  });

  it('compareAgainstProtocol: abstiene cuando no hay fuentes de conocimiento', async () => {
    const { service } = await makeService({ tools: { patient_profile: { nombres: 'Ana' }, anthropometry_tool: { weightKg: 70, heightM: 1.75 }, lab_results: [], get_diagnoses: [{ condicion: 'Diabetes' }] }, retrieveKnowledge: async () => [] });
    const result = await service.executeCapability(REQUEST('compareAgainstProtocol'));
    expect(result.status).toBe('ABSTAINED');
    expect(result.abstentionReason).toMatch(/fuentes/);
  });

  it('fallas de herramientas quedan registradas como toolFailures', async () => {
    const { z } = await import('zod');
    const registry = new AIToolRegistry();
    registry.register(defineTool({ id: 'patient_profile', name: 'p', description: 'p', readOnly: true, riskLevel: 'high', dataCategories: ['pii'], requiredConsent: 'ai_opt_in', minRole: 'nutriologa', maxAgeMs: 1000, schema: { pacienteId: z.string().uuid() }, execute: async () => { throw new Error('db down'); } }));
    const env = { AI_TOOLS_ENABLED: 'true', AI_TOOLS_ALLOWLIST: 'patient_profile' } as NodeJS.ProcessEnv;
    const service = new NutritionCapabilityService({ env, consent: { pacienteId: PATIENT, checker: async () => true }, toolService: new ToolExecutionService(registry, { env }), now: new Date('2026-08-17T00:00:00.000Z') });
    const result = await service.executeCapability(REQUEST('detectNutritionDataGaps'));
    expect(result.toolFailures).toContain('patient_profile:502');
    expect(result.status).toBe('SUCCESS'); // el handler sigue operando con lo disponible
  });

  it('audita cada ejecución', async () => {
    const audit = vi.fn();
    const { service } = await makeService({ audit });
    const result = await service.executeCapability(REQUEST('validateMealPlan', { planItems: [] }));
    expect(result.status).toBe('SUCCESS');
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ capabilityId: 'validateMealPlan', status: 'SUCCESS' }));
  });
});