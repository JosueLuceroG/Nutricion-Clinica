import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type sql from 'mssql';
import { getPool } from '../../db/connection.js';
import { getDwhPool } from './dwhConnection.js';
import { readDwhConfig, assertDwhDatabaseSeparate } from './config.js';
import { applyDwhSchema } from './schema/dwhSchema.js';
import { populateDimDate } from './etl/dimDate.js';
import { runPipeline, runAllPipelines, PIPELINES, ALL_PIPELINE_IDS } from './etl/engine.js';
import { computeMetric, comparePeriods } from './semantic/metricService.js';
import { executeAnalyticsTool } from './analytics/tools.js';
import { resolveScope } from './analytics/authorization.js';
import { buildAnalyticsNarrative, analyticsCertificationGate } from './analytics/aiNarrative.js';

/**
 * VERIFICACIÓN SQL REAL — Build 08 (DWH separado + ETL + semántica).
 * Solo corre con AI_REAL_SQL_TEST=1 contra nc_b08_oltp + nc_b08_dw (PS1 runbook).
 * Sin mocks: fixtures sintéticas OLTP -> ETL -> dims/facts -> reconciliación ->
 * métricas semánticas -> tools -> API. Valores independientemente recalculables.
 */

const REAL_SQL = process.env.AI_REAL_SQL_TEST === '1';

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const P3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PATIENTS = {
  a1: '10000000-0000-4000-8000-000000000001',
  a2: '10000000-0000-4000-8000-000000000002',
  a3: '10000000-0000-4000-8000-000000000003',
  a4: '10000000-0000-4000-8000-000000000004',
  a5: '10000000-0000-4000-8000-000000000005',
  a6: '10000000-0000-4000-8000-000000000006',
  b1: '20000000-0000-4000-8000-000000000001',
  b2: '20000000-0000-4000-8000-000000000002',
  b3: '20000000-0000-4000-8000-000000000003',
} as const;
const PATIENT_LIST = Object.values(PATIENTS);

const ADM = '99999999-9999-4999-8999-999999999999';

describe.runIf(REAL_SQL)('DWH real SQL Build 08 (nc_b08_oltp + nc_b08_dw)', () => {
  let pool: sql.ConnectionPool;
  let dwh: sql.ConnectionPool;

  beforeAll(async () => {
    assertDwhDatabaseSeparate(process.env);
    const config = readDwhConfig();
    expect(config.enabled).toBe(true);
    expect(config.database).toMatch(/nc_b08_dw/i);
    pool = await getPool();
    dwh = await getDwhPool();
    await applyDwhSchema(dwh);
  });

  afterAll(async () => {
    if (pool) await pool.close();
    if (dwh) await dwh.close();
  });

  async function dwhCount(table: string, where = '1=1'): Promise<number> {
    const r = await dwh.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`);
    return r.recordset[0]!.n;
  }

  async function oltpExec(query: string): Promise<void> {
    await pool.request().batch(query);
  }

  async function seedOltpPhase1(): Promise<void> {
    const vals: string[] = [];
    const jan = ['2026-01-05', '2026-01-08', '2026-01-12', '2026-01-15', '2026-01-19', '2026-01-22', '2026-01-25', '2026-01-05', '2026-01-12', '2026-01-20'];
    jan.forEach((d, i) => {
      vals.push(`(N'c0000000-0000-4000-8000-0000000000${String(i + 1).padStart(2, '0')}', N'${S1}', N'${PATIENT_LIST[i % 6]}', N'${P1}', ${i + 1}, '${d}', 'completed', N'Control sintetico', '${d}T12:00:00.000')`);
    });
    const feb = ['2026-02-03', '2026-02-05', '2026-02-08', '2026-02-10', '2026-02-12', '2026-02-14', '2026-02-16', '2026-02-18', '2026-02-20', '2026-02-04', '2026-02-09', '2026-02-13'];
    const febS1P1 = feb.slice(0, 8).map((d, i) => `(N'c0000000-0000-4000-8000-0000000000${String(i + 11).padStart(2, '0')}', N'${S1}', N'${PATIENT_LIST[i % 6]}', N'${P1}', ${i + 11}, '${d}', 'completed', N'Control sintetico', '${d}T12:00:00.000')`);
    const febS1P2 = feb.slice(8, 12).map((d, i) => `(N'c0000000-0000-4000-8000-0000000000${String(i + 19).padStart(2, '0')}', N'${S1}', N'${PATIENT_LIST[(i + 2) % 6]}', N'${P2}', ${i + 19}, '${d}', 'completed', N'Control sintetico', '${d}T12:00:00.000')`);
    const febS2 = ['2026-02-06', '2026-02-15', '2026-02-19'].map((d, i) => `(N'c0000000-0000-4000-8000-0000000000${String(i + 23).padStart(2, '0')}', N'${S2}', N'${PATIENT_LIST[6 + i]}', N'${i === 0 ? P2 : P3}', ${i + 23}, '${d}', 'completed', N'Control sintetico', '${d}T12:00:00.000')`);
    const consultas = [...vals, ...febS1P1, ...febS1P2, ...febS2];

    const pacientes = PATIENT_LIST.map((p, i) => {
      const s = i < 6 ? S1 : S2;
      const pId = i < 6 ? P1 : (i === 6 ? P2 : P3);
      const sex = i % 2 === 0 ? 'female' : 'male';
      return `(N'${p}', N'${s}', N'${pId}', 'Paciente ${i + 1}', 'Apellido Paterno ${i + 1}', '${sex}', '1990-01-0${(i % 9) + 1}', 'active', 'open', '2026-01-01T08:00:00.000')`;
    });

    const antropometrias = [
      `(N'11000000-0000-4000-8000-000000000001', N'${S1}', N'${PATIENTS.a1}', N'${P1}', '2026-01-10', 72.5, 1.62, 27.6, '2026-01-10T12:00:00.000')`,
      `(N'11000000-0000-4000-8000-000000000002', N'${S1}', N'${PATIENTS.a2}', N'${P1}', '2026-01-20', 88.0, 1.75, 28.7, '2026-01-20T12:00:00.000')`,
      `(N'11000000-0000-4000-8000-000000000003', N'${S1}', N'${PATIENTS.a3}', N'${P1}', '2026-02-08', 65.0, 1.58, 26.0, '2026-02-08T12:00:00.000')`,
      `(N'11000000-0000-4000-8000-000000000004', N'${S1}', N'${PATIENTS.a4}', N'${P1}', '2026-02-15', 70.0, 1.60, 27.3, '2026-02-15T12:00:00.000')`,
    ];

    const planes = [
      `(N'12000000-0000-4000-8000-000000000001', N'${S1}', N'${PATIENTS.a1}', N'c0000000-0000-4000-8000-000000000001', N'${P1}', N'Plan B08 uno', '2026-01-08', NULL, 1600, 110, 160, 50, N'[]', 'active', '2026-01-08T12:00:00.000')`,
      `(N'12000000-0000-4000-8000-000000000002', N'${S1}', N'${PATIENTS.a2}', N'c0000000-0000-4000-8000-000000000002', N'${P1}', N'Plan B08 dos', '2026-01-12', '2026-02-12', 1700, 120, 170, 55, N'[]', 'active', '2026-01-12T12:00:00.000')`,
      `(N'12000000-0000-4000-8000-000000000003', N'${S1}', N'${PATIENTS.a3}', N'c0000000-0000-4000-8000-000000000003', N'${P1}', N'Plan B08 tres', '2026-01-20', NULL, 1500, 100, 150, 45, N'[]', 'active', '2026-01-20T12:00:00.000')`,
      `(N'12000000-0000-4000-8000-000000000004', N'${S1}', N'${PATIENTS.a4}', N'c0000000-0000-4000-8000-000000000011', N'${P2}', N'Plan B08 cuatro', '2026-02-05', NULL, 1800, 120, 180, 60, N'[]', 'active', '2026-02-05T12:00:00.000')`,
      `(N'12000000-0000-4000-8000-000000000005', N'${S1}', N'${PATIENTS.a5}', N'c0000000-0000-4000-8000-000000000012', N'${P1}', N'Plan B08 cinco', '2026-02-10', NULL, 1650, 115, 165, 52, N'[]', 'active', '2026-02-10T12:00:00.000')`,
    ];

    const labPanels = [
      `(N'13000000-0000-4000-8000-000000000001', N'${S1}', N'${PATIENTS.a1}', N'${P1}', '2026-01-15', 'Panel A', N'{"glucosa":92,"colesterol":198}', '2026-01-15T12:00:00.000')`,
      `(N'13000000-0000-4000-8000-000000000002', N'${S1}', N'${PATIENTS.a2}', N'${P1}', '2026-02-09', 'Panel B', N'{"hb":13.5}', '2026-02-09T12:00:00.000')`,
    ];

    const adherence = [
      `(N'14000000-0000-4000-8000-000000000001', N'${S1}', N'${PATIENTS.a1}', N'c0000000-0000-4000-8000-000000000001', 'consulta', '2026-01-06', 80, 70, 60, 90, 75, N'3 comidas', '2026-01-06T12:00:00.000')`,
      `(N'14000000-0000-4000-8000-000000000002', N'${S1}', N'${PATIENTS.a2}', N'c0000000-0000-4000-8000-000000000002', 'consulta', '2026-01-13', 70, 80, 70, 85, 80, N'2 comidas', '2026-01-13T12:00:00.000')`,
      `(N'14000000-0000-4000-8000-000000000003', N'${S1}', N'${PATIENTS.a3}', N'c0000000-0000-4000-8000-000000000003', 'consulta', '2026-01-20', 90, 90, 80, 95, 85, N'3 comidas', '2026-01-20T12:00:00.000')`,
      `(N'14000000-0000-4000-8000-000000000004', N'${S1}', N'${PATIENTS.a4}', N'c0000000-0000-4000-8000-000000000004', 'consulta', '2026-01-27', 60, 75, 65, 80, 70, N'2 comidas', '2026-01-27T12:00:00.000')`,
      `(N'14000000-0000-4000-8000-000000000005', N'${S1}', N'${PATIENTS.a5}', N'c0000000-0000-4000-8000-000000000011', 'consulta', '2026-02-04', 100, 85, 90, 100, 95, N'3 comidas', '2026-02-04T12:00:00.000')`,
      `(N'14000000-0000-4000-8000-000000000006', N'${S1}', N'${PATIENTS.a6}', N'c0000000-0000-4000-8000-000000000012', 'consulta', '2026-02-11', 50, 60, 55, 70, 65, N'1 comida', '2026-02-11T12:00:00.000')`,
    ];

    await oltpExec(`
      INSERT INTO sucursales (id, nombre, activa, updated_at) VALUES
        (N'${S1}', 'Sucursal Uno B08', 1, '2026-01-01T08:00:00.000'),
        (N'${S2}', 'Sucursal Dos B08', 1, '2026-01-01T08:00:00.000');
      INSERT INTO profesionales (id, nombre_completo, cedula_profesional, rol, activo, email, password_hash, updated_at) VALUES
        (N'${P1}', 'Nutri Uno B08', 'CP-8001', 'nutriologa', 1, N'p1@b08.test', N'x', '2026-01-01T08:00:00.000'),
        (N'${P2}', 'Nutri Dos B08', 'CP-8002', 'nutriologa', 1, N'p2@b08.test', N'x', '2026-01-01T08:00:00.000'),
        (N'${P3}', 'Nutri Tres B08', 'CP-8003', 'nutriologa', 1, N'p3@b08.test', N'x', '2026-01-01T08:00:00.000');
      INSERT INTO profesional_sucursal (profesional_id, sucursal_id) VALUES
        (N'${P1}', N'${S1}'), (N'${P2}', N'${S1}'), (N'${P2}', N'${S2}'), (N'${P3}', N'${S2}');
      INSERT INTO pacientes (id, sucursal_id, profesional_titular_id, nombres, apellido_paterno, sexo, fecha_nacimiento, estado_expediente, record_status, updated_at) VALUES
        ${pacientes.join(',\n')};
      INSERT INTO consultas (id, sucursal_id, paciente_id, profesional_id, consultation_number, consultation_date, [status], reason, updated_at) VALUES
        ${consultas.join(',\n')};
      INSERT INTO antropometrias (id, sucursal_id, paciente_id, profesional_id, measured_at, weight_kg, height_m, bmi, updated_at) VALUES
        ${antropometrias.join(',\n')};
      INSERT INTO planes_alimenticios (id, sucursal_id, paciente_id, consulta_id, profesional_id, [name], start_date, end_date, kcal_target, protein_target_g, carbs_target_g, fat_target_g, meals_json, [status], updated_at) VALUES
        ${planes.join(',\n')};
      INSERT INTO lab_panels (id, sucursal_id, paciente_id, profesional_id, taken_at, lab_name, results_json, updated_at) VALUES
        ${labPanels.join(',\n')};
      INSERT INTO adherence_records (id, sucursal_id, paciente_id, consulta_id, source, record_date, adherence_menu, adherence_water, adherence_activity, adherence_supplements, adherence_sleep, meals_logged, updated_at) VALUES
        ${adherence.join(',\n')};
    `);
  }

  const scopeAdmin = { sucursalKeys: [] as number[], professionalKey: undefined, isAdmin: true };

  it('DWH vacío (sin carga): métricas => DWH_NOT_READY, nunca 0 fingido', async () => {
    const result = await computeMetric({ metricId: 'consultation_count', from: '2026-01-01', to: '2026-01-31', scope: scopeAdmin });
    expect(result.status).toBe('DWH_NOT_READY');
    expect(result.value).toBeNull();
  });

  it('schema aplicado y versionado (dwh-08-002)', async () => {
    expect(await dwhCount('dwh_schema_version', "schema_version = 'dwh-08-002'")).toBe(1);
    const dims = await dwh.request().query<{ name: string }>(`
      SELECT name FROM sys.tables
      WHERE name IN ('fact_consultation','fact_lab','dwh_rejects','dwh_reconciliation','dwh_pipeline_locks','dwh_watermarks','dim_date')
    `);
    expect(dims.recordset).toHaveLength(7);
  });

  it('dim_date poblada (2020-01-01 .. 2030-12-31)', async () => {
    const n = await populateDimDate(dwh);
    expect(n).toBeGreaterThan(0);
    expect(await dwhCount('dim_date')).toBe(4018);
  });

  it('CARGA FRESCA: dims + facts con conteos exactos de fixture', async () => {
    await seedOltpPhase1();
    const results = await runAllPipelines();
    const byId = new Map(results.map((r) => [r.pipelineId, r]));
    for (const id of ALL_PIPELINE_IDS) {
      const r = byId.get(id);
      expect(r, `pipeline ${id} presente`).toBeDefined();
      expect(r!.status, `pipeline ${id} succeeded`).toBe('succeeded');
      expect(r!.error).toBeNull();
    }
    expect(await dwhCount('dim_sucursal', 'is_current = 1')).toBe(2);
    expect(await dwhCount('dim_professional', 'is_current = 1')).toBe(3);
    expect(await dwhCount('dim_patient')).toBe(9);
    expect(await dwhCount('fact_consultation')).toBe(25);
    expect(await dwhCount('fact_consultation', 'is_deleted = 0')).toBe(25);
    expect(await dwhCount('fact_anthropometry')).toBe(4);
    expect(await dwhCount('fact_meal_plan')).toBe(5);
    expect(await dwhCount('fact_lab')).toBe(3);
    expect(await dwhCount('fact_adherence')).toBe(6);
  });

  it('IDEMPOTENCIA: segunda carga completa no duplica ni regresa watermarks', async () => {
    const before = await dwhCount('fact_consultation');
    const results = await runAllPipelines();
    expect(results.every((r) => r.status === 'succeeded')).toBe(true);
    expect(await dwhCount('fact_consultation')).toBe(before);
    expect(await dwhCount('fact_lab')).toBe(3);
    const wm = await dwh.request().query<{ watermark_at: Date }>(`SELECT watermark_at FROM dwh_watermarks WHERE pipeline_id = 'fact_consultation'`);
    expect(wm.recordset[0]).toBeDefined();
  });

  it('INCREMENTAL + LATE-ARRIVING + SOFT-DELETE: solo cambia lo nuevo/modificado', async () => {
    await oltpExec(`
      INSERT INTO consultas (id, sucursal_id, paciente_id, profesional_id, consultation_number, consultation_date, [status], reason, updated_at) VALUES
        (N'c0000000-0000-4000-8000-000000000099', N'${S1}', N'${PATIENTS.a2}', N'${P1}', 99, '2026-01-20', 'completed', N'Late arriving sintetico', '2026-02-21T09:00:00.000');
      UPDATE consultas SET deleted_at = '2026-02-22T09:00:00.000', updated_at = '2026-02-22T09:00:00.000'
        WHERE id = N'c0000000-0000-4000-8000-000000000023';
      UPDATE pacientes SET estado_expediente = 'archived', updated_at = '2026-02-22T09:00:00.000'
        WHERE id = N'${PATIENTS.b3}';
    `);
    const results = await runAllPipelines();
    expect(results.every((r) => r.status === 'succeeded')).toBe(true);
    expect(await dwhCount('fact_consultation')).toBe(26);
    expect(await dwhCount('fact_consultation', 'is_deleted = 0')).toBe(25);
    expect(await dwhCount('fact_consultation', 'is_deleted = 1')).toBe(1);
    const late = await dwh.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM fact_consultation WHERE source_consultation_id = CONVERT(uniqueidentifier, N'c0000000-0000-4000-8000-000000000099')`);
    expect(late.recordset[0]!.n).toBe(1);
  });

  it('REJECTS: lab malformado entra a dwh_rejects y la reconciliación sigue en 0 de pérdida', async () => {
    await oltpExec(`
      INSERT INTO lab_panels (id, sucursal_id, paciente_id, profesional_id, taken_at, lab_name, results_json, updated_at) VALUES
        (N'13000000-0000-4000-8000-000000000003', N'${S1}', N'${PATIENTS.a1}', N'${P1}', '2026-02-14', 'Panel malformado', N'not-json', '2026-02-23T09:00:00.000'),
        (N'13000000-0000-4000-8000-000000000004', N'${S1}', N'${PATIENTS.a2}', N'${P1}', '2026-02-15', 'Panel vacio', N'{}', '2026-02-23T09:00:00.000');
    `);
    const r = await runPipeline(PIPELINES.fact_lab!, {});
    expect(r.status).toBe('succeeded');
    expect(r.counts.rejected).toBe(2);
    expect(await dwhCount('dwh_rejects', "reason_code = 'invalid_lab_json'")).toBe(1);
    expect(await dwhCount('dwh_rejects', "reason_code = 'no_observations'")).toBe(1);
    expect(await dwhCount('fact_lab')).toBe(3);
  });

  it('RECONCILIACIÓN: UNEXPECTED LOSS = 0 para todos los pipelines', async () => {
    const rows = await dwh.request().query<{ pipeline_id: string; source_expected: number; loaded: number; filtered: number; rejected: number; unexpected_loss: number }>(
      `SELECT pipeline_id, source_expected, loaded, filtered, rejected, unexpected_loss
       FROM dwh_reconciliation
       WHERE reconciliation_id IN (SELECT MAX(reconciliation_id) FROM dwh_reconciliation GROUP BY pipeline_id)`,
    );
    expect(rows.recordset.length).toBe(ALL_PIPELINE_IDS.length);
    for (const row of rows.recordset) {
      expect(row.unexpected_loss, `unexpected_loss ${row.pipeline_id}`).toBe(0);
      expect(row.source_expected, `source=loaded+filtered+rejected ${row.pipeline_id}`).toBe(row.loaded + row.filtered + row.rejected);
    }
  });

  it('MÉTRICAS E2E: valores recalculables del fixture', async () => {
    const jan = await computeMetric({ metricId: 'consultation_count', from: '2026-01-01', to: '2026-01-31', scope: scopeAdmin });
    const feb = await computeMetric({ metricId: 'consultation_count', from: '2026-02-01', to: '2026-02-28', scope: scopeAdmin });
    expect(jan.status).toBe('OK');
    expect(jan.value).toBe(11); // 10 + 1 late-arriving
    expect(feb.status).toBe('OK');
    expect(feb.value).toBe(14); // 15 - 1 soft-deleted

    const newJan = await computeMetric({ metricId: 'new_patients', from: '2026-01-01', to: '2026-01-31', scope: scopeAdmin });
    const newFeb = await computeMetric({ metricId: 'new_patients', from: '2026-02-01', to: '2026-02-28', scope: scopeAdmin });
    expect(newJan.value).toBe(6);
    expect(newFeb.value).toBe(2); // b3 quedó sin consultas activas (023 soft-deleted)

    const patientsJan = await computeMetric({ metricId: 'patient_count', from: '2026-01-01', to: '2026-01-31', scope: scopeAdmin });
    expect(patientsJan.value).toBe(6);

    const adherence = await computeMetric({ metricId: 'adherence_population_summary', from: '2026-01-01', to: '2026-01-31', scope: scopeAdmin });
    expect(adherence.value).toBe(4);
    expect(adherence.series.find((s) => s.key === 'adherence_menu_avg')?.value).toBe(75);

    const mealJan = await computeMetric({ metricId: 'meal_plan_volume', from: '2026-01-01', to: '2026-01-31', scope: scopeAdmin });
    const mealFeb = await computeMetric({ metricId: 'meal_plan_volume', from: '2026-02-01', to: '2026-02-28', scope: scopeAdmin });
    expect(mealJan.value).toBe(3);
    expect(mealFeb.value).toBe(2);

    const labJan = await computeMetric({ metricId: 'lab_observation_volume', from: '2026-01-01', to: '2026-01-31', scope: scopeAdmin });
    const labFeb = await computeMetric({ metricId: 'lab_observation_volume', from: '2026-02-01', to: '2026-02-28', scope: scopeAdmin });
    expect(labJan.value).toBe(2);
    expect(labFeb.value).toBe(1);

    const avg = await computeMetric({ metricId: 'avg_consultations_per_period', from: '2026-01-01', to: '2026-02-28', scope: scopeAdmin });
    expect(avg.value).toBe(12.5); // (11+14)/2 meses
  });

  it('TOOLS E2E: allowlist sobre DWH real', async () => {
    const volume = await executeAnalyticsTool('consultation_volume', { from: '2026-01-01', to: '2026-02-28' }, scopeAdmin);
    expect(volume.status).toBe('OK');
    expect(volume.value).toBe(25);
    expect(volume.series.map((s) => s.value)).toEqual([11, 14]);

    const growth = await executeAnalyticsTool('patient_growth', { from: '2026-02-01', to: '2026-02-28', priorFrom: '2026-01-01', priorTo: '2026-01-31' }, scopeAdmin);
    expect(growth.comparison?.current).toBe(2);
    expect(growth.comparison?.prior).toBe(6);
    expect(growth.comparison?.deltaAbs).toBe(-4);
    expect(growth.comparison?.deltaPct).toBe(-66.7);

    const branches = await executeAnalyticsTool('breakdown_by_branch', { metricId: 'consultation_count', from: '2026-01-01', to: '2026-02-28' }, scopeAdmin);
    expect(branches.series.length).toBe(2);
    const s1 = branches.series.find((s) => s.label === 'Sucursal Uno B08');
    const s2 = branches.series.find((s) => s.label === 'Sucursal Dos B08');
    expect(s1?.value).toBe(23); // 10+1+12 (S1: 10 jan + 1 late + 12 feb)
    expect(s2?.value).toBe(2); // 3 - 1 eliminada

    const metric = await executeAnalyticsTool('get_metric', { metricId: 'consultation_count', from: '2026-01-01', to: '2026-01-31' }, scopeAdmin);
    expect(metric.value).toBe(11);
    expect(metric.evidence[0]?.sourceType).toBe('DWH');
    expect(metric.evidence[0]?.loadRunId).toBeGreaterThan(0);

    const freshness = await executeAnalyticsTool('data_freshness', {}, scopeAdmin);
    expect(freshness.series.length).toBeGreaterThan(0);

    const finance = await executeAnalyticsTool('get_metric', { metricId: 'revenue', from: '2026-01-01', to: '2026-01-31' }, scopeAdmin);
    expect(finance.status).toBe('METRIC_NOT_APPROVED');
    expect(finance.value).toBeNull();
  });

  it('COMPARE PERIODS: sin período previo no divide entre cero', async () => {
    const cmp = await comparePeriods({ metricId: 'consultation_count', from: '2026-02-01', to: '2026-02-28', priorFrom: '2025-02-01', priorTo: '2025-02-28', scope: scopeAdmin });
    expect(cmp.status).toBe('OK');
    expect(cmp.priorAbsent).toBe(true);
    expect(cmp.deltaPct).toBeNull();
    expect(cmp.deltaAbs).toBe(14);
  });

  it('SCOPE REAL: profesional solo ve su sucursal; admin global', async () => {
    const scopeNutri = { sucursalKeys: [await (async () => {
      const r = await dwh.request().query<{ sucursal_key: number }>(`SELECT sucursal_key FROM dim_sucursal WHERE nombre = 'Sucursal Uno B08' AND is_current = 1`);
      return r.recordset[0]!.sucursal_key;
    })()], professionalKey: undefined, isAdmin: false };
    const nutri = await computeMetric({ metricId: 'consultation_count', from: '2026-01-01', to: '2026-02-28', scope: scopeNutri });
    expect(nutri.value).toBe(23);
    const admin = await computeMetric({ metricId: 'consultation_count', from: '2026-01-01', to: '2026-02-28', scope: scopeAdmin });
    expect(admin.value).toBe(25);
  });

  it('FAILURE INJECTION: pipeline falla tras extract, watermark NO avanza, recupera sin inyección', async () => {
    const wmBefore = await dwh.request().query<{ watermark_at: Date }>(`SELECT watermark_at FROM dwh_watermarks WHERE pipeline_id = 'fact_lab'`);
    const failed = await runPipeline(PIPELINES.fact_lab!, { failInjectionPipeline: 'fact_lab' });
    expect(failed.status).toBe('failed');
    expect(failed.error).toContain('INYECTADO');
    const failedRuns = await dwh.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM dwh_load_runs WHERE pipeline_id = 'fact_lab' AND status = 'failed'`);
    expect(failedRuns.recordset[0]!.n).toBeGreaterThan(0);
    const wmAfter = await dwh.request().query<{ watermark_at: Date }>(`SELECT watermark_at FROM dwh_watermarks WHERE pipeline_id = 'fact_lab'`);
    expect(new Date(wmAfter.recordset[0]!.watermark_at).getTime()).toBe(new Date(wmBefore.recordset[0]!.watermark_at).getTime());
    const recovered = await runPipeline(PIPELINES.fact_lab!, {});
    expect(recovered.status).toBe('succeeded');
  });

  it('NARRATIVA: números 200 OK siempre; narrativa ABSTIENE sin modelo APPROVED_ANALYTICS dashboard_analytics', async () => {
    expect(analyticsCertificationGate().eligible).toBe(false);
    const metric = await computeMetric({ metricId: 'consultation_count', from: '2026-01-01', to: '2026-01-31', scope: scopeAdmin });
    expect(metric.value).toBe(11);
    const narrative = buildAnalyticsNarrative({ metric, currentPeriod: '2026-01-01..2026-01-31' });
    expect(narrative.status).toBe('AI_ABSTAINED');
    expect(narrative.reason).toBe('NO_ELIGIBLE_MODEL');
  });

  it('SMALL-CELL: patient_count por sucursal suprime celdas < umbral (S2 tiene 3)', async () => {
    const grouped = await computeMetric({ metricId: 'patient_count', from: '2026-01-01', to: '2026-02-28', scope: scopeAdmin, groupBy: 'sucursal', smallCellMin: 5 });
    expect(grouped.status).toBe('OK');
    const s2 = grouped.series.find((s) => s.label === 'Sucursal Dos B08');
    expect(s2?.value).toBe(-1);
    expect(grouped.suppressedCells).toBe(1);
  });

  it('AUTHZ REAL: resolveScope deriva del token (sucursal cargada)', async () => {
    const user = { sub: ADM, rol: 'admin', sucursalIds: [S1] } as never;
    const scope = await resolveScope(user, S1);
    expect(scope.isAdmin).toBe(true);
    expect(scope.sucursalKeys).toHaveLength(1);
  });

  it('SECRET SCAN de fixture: ningun dato real, solo sintético', async () => {
    const txt = JSON.stringify({ s1: S1, p1: P1 });
    expect(txt).not.toMatch(/NutriCl1n1c4/);
  });
});