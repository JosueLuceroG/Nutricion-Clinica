import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { toolExecutionService } from '../tools/toolExecutionService.js';
import { aiToolRegistry } from '../tools/toolRegistry.js';
import { ERP_TOOLS } from '../tools/erpToolExecutors.js';
import { FIXTURE_UUIDS, REAL_SQL_TOOLS, realSqlConsentChecker, realSqlConsentStatus, seedRealSqlFixture, clearRealSqlFixture } from './realSqlFixture.js';
import { closePool, getPool } from '../../../db/connection.js';
import type { GatewayResult } from '../aiOrchestrator.js';
import type { AICompletionRequest } from '../providers/aiProviderAdapter.js';
import type { ToolResultEnvelope, ToolInvokeFailure } from '../tools/toolExecutionService.js';
import { ToolExecutionService } from '../tools/toolExecutionService.js';
import { NutritionCapabilityService, capabilityCatalogSummary } from '../capabilities/nutritionCapabilityService.js';
import { NUTRITION_CAPABILITY_CATALOG } from '../capabilities/nutritionCapabilityRegistry.js';

const u = FIXTURE_UUIDS;

const REAL_SQL = process.env.AI_REAL_SQL_TEST === '1';

const env = {
  ...process.env,
  AI_TOOLS_ENABLED: 'true',
  AI_TOOLS_ALLOWLIST: REAL_SQL_TOOLS.join(','),
};

const actorNutriA = { profesionalId: u.profesionalA, role: 'nutriologa' as const };
const actorNutriB = { profesionalId: u.profesionalB, role: 'nutriologa' as const };

function invoke(toolId: string, args: Record<string, unknown>, actor: { profesionalId: string; role: 'nutriologa' | 'asistente' } = actorNutriA, sucursalId: string = u.sucursalA, pacienteId: string = u.pacienteA1, overrides: { consent?: boolean; audit?: (e: unknown) => void } = {}): Promise<ToolResultEnvelope> {
  return toolExecutionService.invoke(
    { toolId, args, actor, sucursalId, pacienteId },
    {
      env,
      consent: { pacienteId, checker: async () => overrides.consent ?? true },
      audit: overrides.audit,
      now: new Date('2026-08-17T12:00:00.000Z'),
    },
  ) as Promise<ToolResultEnvelope>;
}

function invokeAny(toolId: string, args: Record<string, unknown>, actor: { profesionalId: string; role: 'nutriologa' | 'asistente' } = actorNutriA, sucursalId: string = u.sucursalA, pacienteId: string = u.pacienteA1, overrides: { consent?: boolean } = {}): Promise<ToolResultEnvelope | ToolInvokeFailure> {
  return toolExecutionService.invoke(
    { toolId, args, actor, sucursalId, pacienteId },
    {
      env,
      consent: { pacienteId, checker: async () => overrides.consent ?? true },
      now: new Date('2026-08-17T12:00:00.000Z'),
    },
  );
}

const fakeCompleteAi = async (req: AICompletionRequest): Promise<GatewayResult> => ({
  ok: true,
  provider: 'fake',
  model: 'fake-model',
  result: {
    content: `Respuesta determinista de prueba para ${(req.userPrompt ?? '').slice(0, 60)}.`,
    model: 'fake-model',
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    finishReason: 'stop',
  },
  attempts: [],
  executionId: 'b061-matrix',
  correlationId: 'b061-matrix',
});

describe.skipIf(!REAL_SQL)('Herramientas ERP contra SQL Server real (Build 06.1)', () => {
  beforeAll(async () => {
    for (const tool of ERP_TOOLS) aiToolRegistry.register(tool);
    await clearRealSqlFixture();
    await seedRealSqlFixture();
  });

  afterAll(async () => {
    await closePool();
  });

  it('SQL Server real: fixture sembrado en la base desechable', async () => {
    const pool = await getPool();
    const result = await pool.request().query('SELECT COUNT(*) AS n FROM pacientes');
    expect(Number(result.recordset[0].n)).toBe(3);
  });

  it('matriz 21/21: cada tool ERP ejecuta contra SQL real y devuelve datos de la sucursal correcta', async () => {
const failures: string[] = [];
    for (const toolId of REAL_SQL_TOOLS) {
      const args: Record<string, unknown> = { pacienteId: u.pacienteA1 };
      if (toolId === 'search_patient') {
        args.query = 'Lopez';
        delete args.pacienteId;
      }
const res = await invokeAny(toolId, args);
      if (!res.ok) {
        failures.push(`${toolId}:${res.status}:${res.error}`);
        continue;
      }
      const data = res.data as unknown;
      const isEmpty = data === null || (Array.isArray(data) && data.length === 0);
      if (isEmpty) failures.push(`${toolId}:empty`);
    }
    expect(failures, failures.join(' | ')).toEqual([]);
  });

  it('aislamiento multi-tenant: profesional de la sucursal A NO ve al paciente de la sucursal B', async () => {
    const res = await invoke('patient_profile', { pacienteId: u.pacienteB1 }, actorNutriA, u.sucursalA);
    expect(res.ok).toBe(true);
    expect(res.data).toBeNull();
    const consultas = await invoke('recent_consultations', { pacienteId: u.pacienteB1 }, actorNutriA, u.sucursalA);
    expect(consultas.data).toEqual([]);
  });

  it('sucursal A no aparece en busquedas de la sucursal B', async () => {
    const res = await invoke('search_patient', { query: 'Lopez' }, actorNutriB, u.sucursalB);
    expect(res.ok).toBe(true);
    expect(res.data).toEqual([]);
  });

  it('inyeccion SQL: pacienteId malicioso no filtra datos (zod -> 400, nunca query)', async () => {
    const attempts = [
      `${u.pacienteA1}' OR 1=1 --`,
      `' OR 1=1 --`,
      '00000000-0000-0000-0000-000000000000; DROP TABLE pacientes; --',
      'no-es-uuid',
    ];
    for (const badId of attempts) {
const res = await invokeAny('patient_profile', { pacienteId: badId });
      expect(res.ok, `deberia fallar con ${badId}`).toBe(false);
      if (!res.ok) expect(res.status).toBe(400);
    }
  });

  it('inyeccion en search_patient: parametrizado, no escapa de la sucursal', async () => {
    const res = await invoke('search_patient', { query: `%' OR 1=1 --` }, actorNutriA, u.sucursalA);
    expect(res.ok).toBe(true);
    const rows = res.data as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThanOrEqual(0);
    for (const row of rows) {
      expect(String(row.apellido_paterno)).not.toContain('OR 1=1');
    }
  });

  it('resultados vacios: paciente sin datos devuelve null/[] sin error', async () => {
    const consultas = await invoke('recent_consultations', { pacienteId: u.pacienteA2 });
    expect(consultas.ok).toBe(true);
    expect(consultas.data).toEqual([]);
    const labs = await invoke('lab_results', { pacienteId: u.pacienteA2 });
    expect(labs.ok).toBe(true);
    expect(labs.data).toEqual([]);
    const plan = await invoke('meal_plan', { pacienteId: u.pacienteA2 });
    expect(plan.ok).toBe(true);
    expect(plan.data).toBeNull();
  });

  it('freshness a nivel datos: la antropometria mas reciente esta dentro de la ventana del tool', async () => {
    const res = await invoke('anthropometry_tool', { pacienteId: u.pacienteA1 });
    expect(res.ok).toBe(true);
    const row = res.data as { measuredAt: string } | null;
    expect(row).not.toBeNull();
    const ageMs = Date.now() - new Date(row!.measuredAt).getTime();
    expect(ageMs).toBeLessThan(15 * 24 * 60 * 60 * 1000);
    expect(res.freshness).toBeDefined();
    expect(res.provenance?.source).toBe('erp');
  });

  it('provenance: fuente erp, query sin datos del paciente, retrievedAt presente', async () => {
    const res = await invoke('lab_results', { pacienteId: u.pacienteA1 });
    expect(res.ok).toBe(true);
    expect(res.provenance?.source).toBe('erp');
    expect(res.provenance?.retrievedAt).toBeDefined();
    expect(String(res.provenance?.query ?? '')).not.toContain(u.pacienteA1);
  });

  it('audit: cada invocacion emite evento con toolId, actor y sucursal', async () => {
    const events: Array<Record<string, unknown>> = [];
    const res = await invoke('get_medications', { pacienteId: u.pacienteA1 }, actorNutriA, u.sucursalA, u.pacienteA1, { audit: (e) => events.push(e as Record<string, unknown>) });
    expect(res.ok).toBe(true);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].toolId).toBe('get_medications');
    expect(events[0].profesionalId).toBe(u.profesionalA);
    expect(events[0].sucursalId).toBe(u.sucursalA);
  });

  it('consentimiento real: sin consentimiento -> 403; con consentimiento -> ok', async () => {
    const status = await realSqlConsentStatus(u.pacienteA1, u.sucursalA);
    expect(status.granted).toBe(true);
const denied = await invokeAny('patient_profile', { pacienteId: u.pacienteA1 }, actorNutriA, u.sucursalA, u.pacienteA1, { consent: false });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.status).toBe(403);
    const granted = await invoke('patient_profile', { pacienteId: u.pacienteA1 }, actorNutriA, u.sucursalA, u.pacienteA1, { consent: true });
    expect(granted.ok).toBe(true);
  });

  it('roles: asistente no puede leer datos clinicos (minRole nutriologa)', async () => {
const res = await invokeAny('patient_profile', { pacienteId: u.pacienteA1 }, { profesionalId: u.profesionalA, role: 'asistente' }, u.sucursalA, u.pacienteA1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });

  it('herramientas deshabilitadas: AI_TOOLS_ENABLED=false -> 503', async () => {
const res = await toolExecutionService.invoke(
      { toolId: 'patient_profile', args: { pacienteId: u.pacienteA1 }, actor: actorNutriA, sucursalId: u.sucursalA, pacienteId: u.pacienteA1 },
      { env: { ...process.env, AI_TOOLS_ENABLED: 'false' }, now: new Date('2026-08-17T12:00:00.000Z') },
    ) as ToolResultEnvelope | ToolInvokeFailure;
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(503);
  });

  it('consultas: upcoming true devuelve solo citas futuras programadas', async () => {
    const upcoming = await invoke('get_appointments', { pacienteId: u.pacienteA1, upcoming: true });
    expect(upcoming.ok).toBe(true);
    const rows = upcoming.data as Array<{ consultation_date: string }>;
    expect(rows.length).toBe(1);
    expect(new Date(rows[0].consultation_date).getTime()).toBeGreaterThan(Date.now());
    const past = await invoke('get_appointments', { pacienteId: u.pacienteA1, upcoming: false });
    const pastRows = past.data as Array<{ consultation_date: string }>;
    expect(pastRows.length).toBe(1);
    expect(new Date(pastRows[0].consultation_date).getTime()).toBeLessThan(Date.now());
  });

it('provenance y datos reales: get_diet devuelve meals_json parseado del plan activo', async () => {
    const res = await invoke('get_diet', { pacienteId: u.pacienteA1 });
    expect(res.ok).toBe(true);
    const diet = res.data as { meals_json: unknown; kcal_target: number } | null;
    expect(diet).not.toBeNull();
    expect(diet!.kcal_target).toBe(1600);
    expect(Array.isArray(diet!.meals_json)).toBe(true);
  });
});

describe.skipIf(!REAL_SQL)('Matriz de capacidades nutricionales contra SQL real (Build 06.1)', () => {
  let matrixService: NutritionCapabilityService;

  beforeAll(async () => {
    const toolService = new ToolExecutionService(aiToolRegistry, { env });
    matrixService = new NutritionCapabilityService({
      env,
      consent: { pacienteId: u.pacienteA1, checker: realSqlConsentChecker },
      toolService,
      completeAi: fakeCompleteAi,
      now: new Date('2026-08-17T12:00:00.000Z'),
    });
  });

  it('21 capacidades canonicas: estado honesto y datos reales verificados por SQL', async () => {
    const summary = capabilityCatalogSummary();
    expect(summary.total).toBe(21);

    const results: string[] = [];
    for (const entry of NUTRITION_CAPABILITY_CATALOG) {
      const input: Record<string, unknown> = {};
      if (entry.capabilityId === 'suggestFoodSubstitutions') input.foodId = 'fruta-manzana';
      if (entry.capabilityId === 'validateMealPlan' || entry.capabilityId === 'reviewMealPlan') {
        input.planItems = [
          { foodId: 'fruta-manzana', foodName: 'Manzana', group: 'frutas', portions: 1 },
          { foodId: 'verdura-zanahoria', foodName: 'Zanahoria', group: 'verduras', portions: 2 },
        ];
      }
      const result = await matrixService.executeCapability({
        capabilityId: entry.capabilityId,
        pacienteId: u.pacienteA1,
        sucursalId: u.sucursalA,
        actor: { profesionalId: u.profesionalA, role: 'nutriologa' },
        input,
      });
      results.push(`${entry.capabilityId}:${result.status}:${result.facts.length}f:${result.reviewRequired ? 'REVIEW' : 'no-review'}`);
      if (entry.status === 'BLOCKED') {
        expect(result.status).toBe('BLOCKED');
      } else if (result.status === 'ABSTAINED') {
        expect(result.abstentionReason ?? '').toMatch(/\S/);
      } else {
        expect(result.status, `${entry.capabilityId} falló: ${result.abstentionReason ?? ''} ${result.blockedReason ?? ''}`).toBe('SUCCESS');
      }
    }
    console.log('MATRIX_RESULTS=' + results.join(','));
  });

  it('detectNutritionDataGaps: brechas reales detectadas desde SQL (antropometria >180 dias, sin labs ni alergias en paciente esparso)', async () => {
    const result = await matrixService.executeCapability({
      capabilityId: 'detectNutritionDataGaps',
      pacienteId: u.pacienteA2,
      sucursalId: u.sucursalA,
      actor: { profesionalId: u.profesionalA, role: 'nutriologa' },
    });
    expect(result.status).toBe('SUCCESS');
    const gaps = (result.payload?.gaps ?? []) as Array<{ field: string }>;
    const fields = gaps.map((g) => g.field).join('|');
    expect(fields).toContain('antropometría desactualizada (>180 días)');
    expect(fields).toContain('laboratorios recientes');
    expect(fields).toContain('registro de alergias');
  });

  it('reviewDrugNutrientInteractions: datos reales (Metformina) -> regla o NO_COVERAGE, nunca invento del LLM', async () => {
    const result = await matrixService.executeCapability({
      capabilityId: 'reviewDrugNutrientInteractions',
      pacienteId: u.pacienteA1,
      sucursalId: u.sucursalA,
      actor: { profesionalId: u.profesionalA, role: 'nutriologa' },
    });
    expect(result.status).toBe('SUCCESS');
    const rules = (result.payload?.interactions ?? []) as Array<{ evidence: { code: string } }>;
    for (const rule of rules) {
      expect(['KNOWN_RULE_MATCH', 'NO_KNOWN_INTERACTION', 'NO_COVERAGE', 'INSUFFICIENT_DATA']).toContain(rule.evidence.code);
    }
  });
});
