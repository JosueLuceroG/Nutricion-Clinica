import "dotenv/config";
import sql from 'mssql';
import { getPool, closePool } from './connection.js';
import { assertTargetSafe } from '../modules/deployment/targetGuard.js';
import { readEnvironmentClass } from '../modules/deployment/environmentIdentity.js';

/**
 * Reset controlado de datos sintéticos de staging (Build 09.5A §48).
 * - Exige ENVIRONMENT_CLASS=STAGING (o TEST); PRODUCTION/UNKNOWN: fail-closed.
 * - Solo toca tablas sintéticas de observabilidad/shadow/egreso: NUNCA tablas
 *   clínicas (pacientes, consultas, recetas) ni el DWH de producción.
 * - Preserva el esquema (no drop tables, no drop DB).
 */

const SYNTHETIC_TABLES = [
  'ai_telemetry_events',
  'ai_telemetry_aggregates',
  'ai_telemetry_alerts',
  'shadow_state',
  'shadow_runs',
  'shadow_reviews',
  'shadow_auto_disable_events',
  'shadow_cohorts',
  'ai_egress_manifests',
  'ai_agent_runs',
  'ai_actions',
  'ai_specialization_decisions',
];

export async function resetStagingSyntheticData(env: NodeJS.ProcessEnv = process.env): Promise<{ resetTables: string[] }> {
  const environmentClass = readEnvironmentClass(env);
  if (environmentClass !== 'STAGING' && environmentClass !== 'TEST') {
    throw new Error(
      `reset de staging requiere ENVIRONMENT_CLASS=STAGING/TEST explícito (recibido '${environmentClass}'): fail-closed`,
    );
  }
  assertTargetSafe('reset', env);
  const pool = await getPool();
  const resetTables: string[] = [];
  for (const table of SYNTHETIC_TABLES) {
    const exists = await pool
      .request()
      .input('t', sql.NVarChar(100), table)
      .query<{ n: number }>(`SELECT COUNT(*) AS n FROM sys.tables WHERE name = @t`);
    if (exists.recordset[0]!.n === 1) {
      await pool.request().query(`TRUNCATE TABLE ${table}`);
      resetTables.push(table);
    }
  }
  return { resetTables };
}

async function main(): Promise<void> {
  console.log('=== nutriclinica: reset de datos sintéticos de staging ===');
  try {
    const result = await resetStagingSyntheticData();
    console.log(`ok tablas reseteadas: ${result.resetTables.length} (${result.resetTables.join(', ') || 'ninguna'})`);
    console.log('esquema preservado; datos clínicos intactos');
  } catch (err) {
    console.error('error en reset:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('stagingReset.ts');
if (invokedDirectly) {
  void main();
}