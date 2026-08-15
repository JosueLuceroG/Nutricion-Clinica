import sql from 'mssql';
import { z } from 'zod';
import { getPool } from '../../../db/connection.js';
import { defineTool, uuidField } from './toolDefinition.js';

async function assertPatientInSucursal(pid: string, sid: string): Promise<boolean> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, pid)
    .input('sucursal_id', sql.UniqueIdentifier, sid)
    .query('SELECT TOP 1 1 AS found FROM pacientes WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL');
  return result.recordset.length > 0;
}

async function execRead<T>(query: string, inputs: { name: string; type: () => sql.ISqlType; value: unknown }[]): Promise<T[]> {
  const pool = await getPool();
  const req = pool.request();
  for (const input of inputs) req.input(input.name, input.type(), input.value);
  const result = await req.query(query);
  return result.recordset as T[];
}

const PATIENT_INPUT = (pid: string, sid: string) => [
  { name: 'id', type: () => sql.UniqueIdentifier(), value: pid },
  { name: 'sucursal_id', type: () => sql.UniqueIdentifier(), value: sid },
];

export const patientProfileTool = defineTool({
  id: 'patient_profile',
  name: 'Perfil del paciente',
  description: 'Lee los datos demograficos y de contacto del paciente (read-only).',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['pii'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 15 * 60 * 1000,
  schema: { pacienteId: uuidField('pacienteId es requerido') },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return null;
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP 1 id, nombres, apellido_paterno, apellido_materno, email, telefono, fecha_nacimiento, genero, estado_expediente
       FROM pacientes WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`,
      PATIENT_INPUT(args.pacienteId, ctx.sucursalId),
    );
    return rows[0] ?? null;
  },
});

export const recentConsultationsTool = defineTool({
  id: 'recent_consultations',
  name: 'Consultas recientes',
  description: 'Lee las consultas mas recientes del paciente (read-only).',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['clinical'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 15 * 60 * 1000,
  schema: { pacienteId: uuidField('pacienteId es requerido'), limit: z.number().int().min(1).max(20).optional() },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return [];
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP (@limit) id, consultation_number, consultation_date, [status], reason, assessment
       FROM consultas WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY consultation_date DESC`,
      [...PATIENT_INPUT(args.pacienteId, ctx.sucursalId), { name: 'limit', type: () => sql.Int(), value: args.limit ?? 10 }],
    );
    return rows;
  },
});

export const labResultsTool = defineTool({
  id: 'lab_results',
  name: 'Resultados de laboratorio',
  description: 'Lee los paneles de laboratorio recientes del paciente (read-only).',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['clinical'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 15 * 60 * 1000,
  schema: { pacienteId: uuidField('pacienteId es requerido'), limit: z.number().int().min(1).max(50).optional() },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return [];
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP (@limit) id, taken_at, lab_name, results_json, notes
       FROM lab_panels WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY taken_at DESC`,
      [...PATIENT_INPUT(args.pacienteId, ctx.sucursalId), { name: 'limit', type: () => sql.Int(), value: args.limit ?? 20 }],
    );
    return rows.map((row) => {
      const parsed = { ...row };
      try {
        parsed.results_json = JSON.parse(row.results_json as string);
      } catch {
        parsed.results_json = row.results_json;
      }
      return parsed;
    });
  },
});

export const mealPlanTool = defineTool({
  id: 'meal_plan',
  name: 'Plan alimenticio',
  description: 'Lee el plan de alimentacion activo del paciente (read-only).',
  readOnly: true,
  riskLevel: 'medium',
  dataCategories: ['clinical'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 60 * 60 * 1000,
  schema: { pacienteId: uuidField('pacienteId es requerido') },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return null;
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP 1 id, [name], description, start_date, end_date, kcal_target, protein_target_g, carbs_target_g, fat_target_g, [status]
       FROM planes_alimenticios WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND [status] = 'active' AND deleted_at IS NULL ORDER BY start_date DESC`,
      PATIENT_INPUT(args.pacienteId, ctx.sucursalId),
    );
    return rows[0] ?? null;
  },
});

export const adherenceSummaryTool = defineTool({
  id: 'adherence_summary',
  name: 'Resumen de adherencia',
  description: 'Lee los registros de adherencia recientes del paciente (read-only).',
  readOnly: true,
  riskLevel: 'medium',
  dataCategories: ['clinical'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 60 * 60 * 1000,
  schema: { pacienteId: uuidField('pacienteId es requerido') },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return [];
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP 10 id, record_date, adherence_menu, adherence_water, adherence_activity, adherence_supplements, adherence_sleep
       FROM adherence_records WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY record_date DESC`,
      PATIENT_INPUT(args.pacienteId, ctx.sucursalId),
    );
    return rows;
  },
});

export const billingHistoryTool = defineTool({
  id: 'billing_history',
  name: 'Historial de pagos',
  description: 'Lee el historial de pagos recientes del paciente (read-only).',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['financial'],
  requiredConsent: 'ai_opt_in',
  minRole: 'facturacion',
  maxAgeMs: 60 * 60 * 1000,
  schema: { pacienteId: uuidField('pacienteId es requerido') },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return [];
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP 10 id, fecha, monto, metodo_pago, [status]
       FROM pagos WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY fecha DESC`,
      PATIENT_INPUT(args.pacienteId, ctx.sucursalId),
    );
    return rows;
  },
});

export const anthropometryTool = defineTool({
  id: 'anthropometry_tool',
  name: 'Antropometria reciente',
  description: 'Lee la antropometria mas reciente del paciente (read-only).',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['clinical'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 60 * 60 * 1000,
  schema: { pacienteId: uuidField('pacienteId es requerido') },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return null;
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP 1 id, measured_at, weight_kg, height_m, waist_cm
       FROM antropometrias WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY measured_at DESC`,
      PATIENT_INPUT(args.pacienteId, ctx.sucursalId),
    );
    const row = rows[0];
    if (!row) return null;
    return { weightKg: Number(row.weight_kg), heightM: Number(row.height_m), measuredAt: String(row.measured_at) };
  },
});

export const ERP_TOOLS = [patientProfileTool, anthropometryTool, recentConsultationsTool, labResultsTool, mealPlanTool, adherenceSummaryTool, billingHistoryTool];