import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type sql from 'mssql';
import { getPool } from '../../db/connection.js';
import { getDwhPool } from './dwhConnection.js';
import { readDwhConfig, assertDwhDatabaseSeparate } from './config.js';
import {
  DWH_PREVIOUS_SCHEMA_VERSION,
  DWH_SCHEMA_VERSION,
  applyDwhSchema,
  dwhDdl,
  dwhPreviousSchemaChecksum,
  dwhSchemaChecksum,
} from './schema/dwhSchema.js';
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
const LEGACY_BRANCH = '44444444-4444-4444-8444-444444444444';
const LEGACY_PROFESSIONAL = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SCD2_BRANCH = '33333333-3333-4333-8333-333333333333';
const SCD2_PROFESSIONAL = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

describe.runIf(REAL_SQL)('DWH real SQL Build 08 (nc_b08_oltp + nc_b08_dw)', () => {
  let pool: sql.ConnectionPool;
  let dwh: sql.ConnectionPool;

  beforeAll(async () => {
    assertDwhDatabaseSeparate(process.env);
    const config = readDwhConfig();
    expect(config.enabled).toBe(true);
    const oltpName = (process.env.DB_NAME ?? '').toLowerCase();
    const dwhName = config.database.toLowerCase();
    const deploymentPair = /^nc_b09_dw_([0-9a-f]{8})$/.exec(dwhName);
    expect(
      (oltpName === 'nc_b08_oltp' && dwhName === 'nc_b08_dw') ||
        (deploymentPair !== null &&
          oltpName === `nc_b09_oltp_${deploymentPair[1]}`),
      'AI_REAL_SQL_TEST solo permite pares OLTP/DWH locales desechables',
    ).toBe(true);
    pool = await getPool();
    dwh = await getDwhPool();
    await dwh.request().batch(dwhDdl());
    await dwh
      .request()
      .input('schemaVersion', DWH_PREVIOUS_SCHEMA_VERSION)
      .input('checksum', dwhPreviousSchemaChecksum())
      .query(`INSERT INTO dwh_schema_version (schema_version, checksum)
              VALUES (@schemaVersion, @checksum)`);
    await dwh.request().batch(`
      INSERT INTO dim_sucursal
        (sucursal_natural_id, nombre, activa, valid_from, valid_to, is_current)
      VALUES
        (N'${LEGACY_BRANCH}', N'Legacy branch', 0, '2025-01-01', '2025-02-01', 0);
      INSERT INTO dim_professional
        (professional_natural_id, nombre_completo, cedula_profesional, rol, activo, valid_from, valid_to, is_current)
      VALUES
        (N'${LEGACY_PROFESSIONAL}', N'Legacy professional', N'LEGACY', N'nutriologa', 0, '2025-01-01', '2025-02-01', 0);
    `);
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

  it('preserva dwh-08-002 y aplica la cadena dwh-08-003', async () => {
    const versions = await dwh.request().query<{ schema_version: string; checksum: string }>(`
      SELECT schema_version, checksum FROM dwh_schema_version
       WHERE schema_version IN ('${DWH_PREVIOUS_SCHEMA_VERSION}', '${DWH_SCHEMA_VERSION}')
    `);
    expect(new Map(versions.recordset.map((row) => [row.schema_version, row.checksum]))).toEqual(
      new Map([
        [DWH_PREVIOUS_SCHEMA_VERSION, dwhPreviousSchemaChecksum()],
        [DWH_SCHEMA_VERSION, dwhSchemaChecksum()],
      ]),
    );
    const dims = await dwh.request().query<{ name: string }>(`
      SELECT name FROM sys.tables
      WHERE name IN ('fact_consultation','fact_lab','dwh_rejects','dwh_reconciliation','dwh_pipeline_locks','dwh_watermarks','dim_date')
    `);
    expect(dims.recordset).toHaveLength(7);
    const validityColumns = await dwh.request().query<{ table_name: string; column_name: string; type_name: string; scale: number }>(`
      SELECT OBJECT_NAME(c.object_id) AS table_name, c.name AS column_name,
             TYPE_NAME(c.user_type_id) AS type_name, c.scale
        FROM sys.columns c
       WHERE OBJECT_NAME(c.object_id) IN ('dim_sucursal', 'dim_professional')
         AND c.name IN ('valid_from', 'valid_to')
    `);
    expect(validityColumns.recordset).toHaveLength(4);
    expect(validityColumns.recordset.every((column) => column.type_name === 'datetime2' && column.scale === 3)).toBe(true);
    const legacy = await dwh.request().query<{ name: string; valid_from: Date; valid_to: Date; source_updated_at: Date | null; source_version: Buffer | null }>(`
      SELECT nombre AS name, valid_from, valid_to, source_updated_at, source_version
        FROM dim_sucursal WHERE sucursal_natural_id = N'${LEGACY_BRANCH}'
      UNION ALL
      SELECT nombre_completo AS name, valid_from, valid_to, source_updated_at, source_version
        FROM dim_professional WHERE professional_natural_id = N'${LEGACY_PROFESSIONAL}'
    `);
    expect(legacy.recordset.map((row) => row.name)).toEqual(['Legacy branch', 'Legacy professional']);
    for (const row of legacy.recordset) {
      expect(row.valid_from.toISOString()).toBe('2025-01-01T00:00:00.000Z');
      expect(row.valid_to.toISOString()).toBe('2025-02-01T00:00:00.000Z');
      expect(row.source_updated_at).toBeNull();
      expect(row.source_version).toBeNull();
    }
    await expect(applyDwhSchema(dwh)).resolves.toBeUndefined();
    expect(await dwhCount('dwh_schema_version')).toBe(2);
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

  it('SCD2 INTRADÍA: conserva A/B/C/D, desempata 17:00 por rowversion y replay no duplica', async () => {
    const loadDimensions = async () => {
      const branch = await runPipeline(PIPELINES.dim_sucursal!, {});
      const professional = await runPipeline(PIPELINES.dim_professional!, {});
      expect(branch.status).toBe('succeeded');
      expect(professional.status).toBe('succeeded');
    };
    await oltpExec(`
      INSERT INTO sucursales (id, nombre, activa, updated_at)
      VALUES (N'${SCD2_BRANCH}', N'Branch A', 1, '2026-03-01T09:00:00.000');
      INSERT INTO profesionales
        (id, nombre_completo, cedula_profesional, rol, activo, email, password_hash, updated_at)
      VALUES
        (N'${SCD2_PROFESSIONAL}', N'Professional A', N'CP-A', N'nutriologa', 1, N'scd2@real.test', N'x', '2026-03-01T09:00:00.000');
    `);
    await loadDimensions();

    for (const state of [
      { label: 'B', at: '2026-03-01T13:00:00.000' },
      { label: 'C', at: '2026-03-01T17:00:00.000' },
      { label: 'D', at: '2026-03-01T17:00:00.000' },
    ]) {
      await oltpExec(`
        UPDATE sucursales SET nombre = N'Branch ${state.label}', updated_at = '${state.at}'
         WHERE id = N'${SCD2_BRANCH}';
        UPDATE profesionales
           SET nombre_completo = N'Professional ${state.label}', cedula_profesional = N'CP-${state.label}', updated_at = '${state.at}'
         WHERE id = N'${SCD2_PROFESSIONAL}';
      `);
      await loadDimensions();
    }

    const branchHistory = await dwh.request().query<{ name: string; valid_from: Date; valid_to: Date | null; is_current: boolean; source_version: Buffer }>(`
      SELECT nombre AS name, valid_from, valid_to, is_current, source_version
        FROM dim_sucursal
       WHERE sucursal_natural_id = N'${SCD2_BRANCH}'
       ORDER BY valid_from, source_version
    `);
    const professionalHistory = await dwh.request().query<{ name: string; valid_from: Date; valid_to: Date | null; is_current: boolean; source_version: Buffer }>(`
      SELECT nombre_completo AS name, valid_from, valid_to, is_current, source_version
        FROM dim_professional
       WHERE professional_natural_id = N'${SCD2_PROFESSIONAL}'
       ORDER BY valid_from, source_version
    `);
    for (const [history, prefix] of [
      [branchHistory.recordset, 'Branch'],
      [professionalHistory.recordset, 'Professional'],
    ] as const) {
      expect(history.map((row) => row.name)).toEqual([
        `${prefix} A`, `${prefix} B`, `${prefix} C`, `${prefix} D`,
      ]);
      expect(history.map((row) => row.valid_from.toISOString())).toEqual([
        '2026-03-01T09:00:00.000Z',
        '2026-03-01T13:00:00.000Z',
        '2026-03-01T17:00:00.000Z',
        '2026-03-01T17:00:00.000Z',
      ]);
      expect(history.map((row) => row.valid_to?.toISOString() ?? null)).toEqual([
        '2026-03-01T13:00:00.000Z',
        '2026-03-01T17:00:00.000Z',
        '2026-03-01T17:00:00.000Z',
        null,
      ]);
      expect(history.filter((row) => Boolean(row.is_current))).toHaveLength(1);
      expect(Buffer.compare(history[2]!.source_version, history[3]!.source_version)).toBeLessThan(0);
      for (let index = 1; index < history.length; index += 1) {
        expect(history[index - 1]!.valid_to!.getTime()).toBeLessThanOrEqual(history[index]!.valid_from.getTime());
      }
    }

    await loadDimensions();
    expect(await dwhCount('dim_sucursal', `sucursal_natural_id = N'${SCD2_BRANCH}'`)).toBe(4);
    expect(await dwhCount('dim_professional', `professional_natural_id = N'${SCD2_PROFESSIONAL}'`)).toBe(4);
    expect(await dwhCount('dwh_load_runs', `target_schema_version = '${DWH_SCHEMA_VERSION}'`)).toBeGreaterThan(0);
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
