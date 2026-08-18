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

const PATIENT_ONLY_INPUT = (pid: string) => [{ name: 'id', type: () => sql.UniqueIdentifier(), value: pid }];

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
  toolVersion: '1.0.0',
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

export const searchPatientTool = defineTool({
  id: 'search_patient',
  name: 'Busqueda de paciente',
  description: 'Busca pacientes por nombre, apellidos o telefono dentro de la sucursal (read-only, uso profesional).',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['pii'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 15 * 60 * 1000,
  patientScoped: false,
  toolVersion: '1.0.0',
  schema: { query: z.string().min(2).max(120), limit: z.number().int().min(1).max(20).optional() },
  execute: async ({ args, ctx }) => {
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP (@limit) id, nombres, apellido_paterno, apellido_materno, telefono, fecha_nacimiento
       FROM pacientes
       WHERE sucursal_id = @sucursal_id AND deleted_at IS NULL
         AND (nombres LIKE @q OR apellido_paterno LIKE @q OR apellido_materno LIKE @q OR telefono LIKE @q)
       ORDER BY apellido_paterno, apellido_materno, nombres`,
      [
        { name: 'sucursal_id', type: () => sql.UniqueIdentifier(), value: ctx.sucursalId },
        { name: 'q', type: () => sql.NVarChar(130), value: `%${args.query}%` },
        { name: 'limit', type: () => sql.Int(), value: args.limit ?? 10 },
      ],
    );
    return rows;
  },
});

export const patientHistoryTool = defineTool({
  id: 'get_patient_history',
  name: 'Historia del paciente',
  description: 'Composicion acotada de la historia del paciente: consultas, antropometria, laboratorios, planes y adherencia dentro de una ventana (read-only).',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['clinical'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 60 * 60 * 1000,
  toolVersion: '1.0.0',
  schema: { pacienteId: uuidField('pacienteId es requerido'), daysBack: z.number().int().min(30).max(730).optional() },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return null;
    const since = new Date(Date.now() - (args.daysBack ?? 180) * 24 * 60 * 60 * 1000).toISOString();
    const sinceInput = { name: 'since', type: () => sql.DateTime2(3), value: since };
    const [consultations, anthropometry, labs, plans, adherence] = await Promise.all([
      execRead<Record<string, unknown>>(
        `SELECT id, consultation_number, consultation_date, [status], reason FROM consultas
         WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL AND consultation_date >= @since
         ORDER BY consultation_date DESC`,
        [...PATIENT_INPUT(args.pacienteId, ctx.sucursalId), sinceInput],
      ),
      execRead<Record<string, unknown>>(
        `SELECT TOP 20 measured_at, weight_kg, height_m, bmi FROM antropometrias
         WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL AND measured_at >= @since
         ORDER BY measured_at DESC`,
        [...PATIENT_INPUT(args.pacienteId, ctx.sucursalId), sinceInput],
      ),
      execRead<Record<string, unknown>>(
        `SELECT TOP 10 id, taken_at, lab_name FROM lab_panels
         WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL AND taken_at >= @since
         ORDER BY taken_at DESC`,
        [...PATIENT_INPUT(args.pacienteId, ctx.sucursalId), sinceInput],
      ),
      execRead<Record<string, unknown>>(
        `SELECT id, [name], start_date, end_date, [status], kcal_target FROM planes_alimenticios
         WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL AND start_date >= @since
         ORDER BY start_date DESC`,
        [...PATIENT_INPUT(args.pacienteId, ctx.sucursalId), sinceInput],
      ),
      execRead<Record<string, unknown>>(
        `SELECT TOP 10 record_date, adherence_menu, adherence_water FROM adherence_records
         WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL AND record_date >= @since
         ORDER BY record_date DESC`,
        [...PATIENT_INPUT(args.pacienteId, ctx.sucursalId), sinceInput],
      ),
    ]);
    return { windowDays: args.daysBack ?? 180, consultations, anthropometry, labs, plans, adherence };
  },
});

export const dietDetailTool = defineTool({
  id: 'get_diet',
  name: 'Detalle de la dieta',
  description: 'Lee los alimentos/comidas del plan alimenticio activo del paciente (meals_json) y sus objetivos (read-only).',
  readOnly: true,
  riskLevel: 'medium',
  dataCategories: ['clinical'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 60 * 60 * 1000,
  toolVersion: '1.0.0',
  schema: { pacienteId: uuidField('pacienteId es requerido') },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return null;
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP 1 id, [name], start_date, end_date, kcal_target, protein_target_g, carbs_target_g, fat_target_g, meals_json
       FROM planes_alimenticios WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND [status] = 'active' AND deleted_at IS NULL ORDER BY start_date DESC`,
      PATIENT_INPUT(args.pacienteId, ctx.sucursalId),
    );
    const row = rows[0];
    if (!row) return null;
    const diet = { ...row };
    try {
      diet.meals_json = JSON.parse(row.meals_json as string);
    } catch {
      diet.meals_json = row.meals_json;
    }
    return diet;
  },
});

export const bodyCompositionTool = defineTool({
  id: 'get_body_composition',
  name: 'Composicion corporal',
  description: 'Lee la composicion corporal registrada del paciente: IMC (calculado), porcentaje de grasa, circunferencias y pliegues (read-only).',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['clinical'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 60 * 60 * 1000,
  toolVersion: '1.0.0',
  schema: { pacienteId: uuidField('pacienteId es requerido') },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return null;
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP 1 measured_at, weight_kg, height_m, bmi, body_fat_pct, waist_cm, hip_cm, neck_cm, chest_cm, arm_cm, forearm_cm, thigh_cm, calf_cm,
              tricipital_mm, bicipital_mm, subescapular_mm, suprailiaco_mm, abdominal_mm, muslo_mm, pantorrilla_mm, notes
       FROM antropometrias WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY measured_at DESC`,
      PATIENT_INPUT(args.pacienteId, ctx.sucursalId),
    );
    const row = rows[0];
    if (!row) return null;
    const circumferenceKeys = ['waist_cm', 'hip_cm', 'neck_cm', 'chest_cm', 'arm_cm', 'forearm_cm', 'thigh_cm', 'calf_cm'];
    const skinfoldKeys = ['tricipital_mm', 'bicipital_mm', 'subescapular_mm', 'suprailiaco_mm', 'abdominal_mm', 'muslo_mm', 'pantorrilla_mm'];
    const pick = (keys: string[]): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const key of keys) {
        const value = row[key];
        if (value !== null && value !== undefined) out[key] = Number(value);
      }
      return out;
    };
    const bmi = row.bmi !== null && row.bmi !== undefined ? Number(row.bmi) : null;
    return {
      measuredAt: String(row.measured_at),
      weightKg: Number(row.weight_kg),
      heightM: Number(row.height_m),
      bmi: { value: bmi, label: 'CALCULATED', basis: bmi !== null ? 'IMC = peso / talla^2 (derivado en el registro)' : 'no registrado' },
      bodyFatPct: row.body_fat_pct !== null && row.body_fat_pct !== undefined ? { value: Number(row.body_fat_pct), label: 'MEASURED' } : null,
      circumferences: pick(circumferenceKeys),
      skinfolds: pick(skinfoldKeys),
      notes: row.notes ?? null,
    };
  },
});

export const vitalSignsTool = defineTool({
  id: 'get_vital_signs',
  name: 'Signos vitales',
  description: 'Lee los signos vitales estructurados registrados en las consultas del paciente (vitals_json; solo cuando estan registrados).',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['clinical'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 15 * 60 * 1000,
  toolVersion: '1.0.0',
  schema: { pacienteId: uuidField('pacienteId es requerido'), limit: z.number().int().min(1).max(20).optional() },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return [];
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP (@limit) id, consultation_date, vitals_json
       FROM consultas WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND vitals_json IS NOT NULL AND deleted_at IS NULL
       ORDER BY consultation_date DESC`,
      [...PATIENT_INPUT(args.pacienteId, ctx.sucursalId), { name: 'limit', type: () => sql.Int(), value: args.limit ?? 10 }],
    );
    return rows.map((row) => {
      const parsed = { ...row };
      try {
        parsed.vitals_json = JSON.parse(row.vitals_json as string);
      } catch {
        parsed.vitals_json = row.vitals_json;
      }
      return parsed;
    });
  },
});

export const medicationsTool = defineTool({
  id: 'get_medications',
  name: 'Medicamentos',
  description: 'Lee los medicamentos activos del paciente (read-only).',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['clinical'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 60 * 60 * 1000,
  toolVersion: '1.0.0',
  schema: { pacienteId: uuidField('pacienteId es requerido') },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return [];
    const rows = await execRead<Record<string, unknown>>(
      `SELECT id, nombre, dosis, frecuencia, via_administracion, fecha_inicio, fecha_fin, motivo, activo
       FROM medicamentos WHERE paciente_id = @id AND deleted_at IS NULL AND activo = 1
       ORDER BY fecha_inicio DESC`,
      PATIENT_ONLY_INPUT(args.pacienteId),
    );
    return rows;
  },
});

export const allergiesTool = defineTool({
  id: 'get_allergies',
  name: 'Alergias',
  description: 'Lee las alergias registradas del paciente (read-only).',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['clinical'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 60 * 60 * 1000,
  toolVersion: '1.0.0',
  schema: { pacienteId: uuidField('pacienteId es requerido') },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return [];
    const rows = await execRead<Record<string, unknown>>(
      `SELECT id, sustancia, reaccion, severidad, diagnosticada, notas
       FROM alergias WHERE paciente_id = @id AND deleted_at IS NULL ORDER BY created_at DESC`,
      PATIENT_ONLY_INPUT(args.pacienteId),
    );
    return rows;
  },
});

export const intolerancesTool = defineTool({
  id: 'get_intolerances',
  name: 'Intolerancias',
  description: 'Lee las intolerancias alimentarias registradas del paciente (read-only).',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['clinical'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 60 * 60 * 1000,
  toolVersion: '1.0.0',
  schema: { pacienteId: uuidField('pacienteId es requerido') },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return [];
    const rows = await execRead<Record<string, unknown>>(
      `SELECT id, alimento, sintomas, severidad, notas
       FROM intolerancias WHERE paciente_id = @id AND deleted_at IS NULL ORDER BY created_at DESC`,
      PATIENT_ONLY_INPUT(args.pacienteId),
    );
    return rows;
  },
});

export const diagnosesTool = defineTool({
  id: 'get_diagnoses',
  name: 'Diagnosticos / condiciones',
  description: 'Lee las condiciones y diagnosticos de la historia personal del paciente (read-only).',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['clinical'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 60 * 60 * 1000,
  toolVersion: '1.0.0',
  schema: { pacienteId: uuidField('pacienteId es requerido') },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return [];
    const rows = await execRead<Record<string, unknown>>(
      `SELECT id, condicion, fecha_diagnostico, estado, tratamiento, notas
       FROM historia_personal WHERE paciente_id = @id AND deleted_at IS NULL ORDER BY fecha_diagnostico DESC`,
      PATIENT_ONLY_INPUT(args.pacienteId),
    );
    return rows;
  },
});

export const clinicalNotesTool = defineTool({
  id: 'get_clinical_notes',
  name: 'Notas clinicas',
  description: 'Lee las notas SOAP de las consultas del paciente (subjetivo, objetivo, evaluacion y plan). Datos sensibles, uso profesional exclusivo.',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['clinical', 'pii'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 15 * 60 * 1000,
  toolVersion: '1.0.0',
  schema: { pacienteId: uuidField('pacienteId es requerido'), limit: z.number().int().min(1).max(10).optional() },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return [];
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP (@limit) id, consultation_date, subjective, objective, assessment, [plan]
       FROM consultas WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL
       ORDER BY consultation_date DESC`,
      [...PATIENT_INPUT(args.pacienteId, ctx.sucursalId), { name: 'limit', type: () => sql.Int(), value: args.limit ?? 5 }],
    );
    return rows;
  },
});

export const documentsTool = defineTool({
  id: 'get_documents',
  name: 'Documentos del expediente',
  description: 'Lee los metadatos de documentos del expediente del paciente (tipo, nombre, tamano, hash). No expone el contenido ni la ubicacion de almacenamiento.',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['clinical', 'pii'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 60 * 60 * 1000,
  toolVersion: '1.0.0',
  schema: { pacienteId: uuidField('pacienteId es requerido'), limit: z.number().int().min(1).max(50).optional() },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return [];
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP (@limit) id, tipo, nombre_archivo, mime_type, tamano_bytes, hash_sha256, fecha_documento, notas
       FROM documentos WHERE paciente_id = @id AND deleted_at IS NULL ORDER BY created_at DESC`,
      [...PATIENT_ONLY_INPUT(args.pacienteId), { name: 'limit', type: () => sql.Int(), value: args.limit ?? 20 }],
    );
    return rows;
  },
});

export const appointmentsTool = defineTool({
  id: 'get_appointments',
  name: 'Citas',
  description: 'Lee las citas programadas del paciente (consultas con status scheduled, proximas o pasadas segun el modo). Proxy parcial: no existe tabla de citas independiente.',
  readOnly: true,
  riskLevel: 'medium',
  dataCategories: ['operational'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 60 * 60 * 1000,
  toolVersion: '1.0.0',
  schema: { pacienteId: uuidField('pacienteId es requerido'), limit: z.number().int().min(1).max(20).optional(), upcoming: z.boolean().optional() },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return [];
    const now = new Date().toISOString();
    const order = args.upcoming === false ? 'DESC' : 'ASC';
    const direction = args.upcoming === false ? '<=' : '>=';
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP (@limit) id, consultation_number, consultation_date, [status], reason
       FROM consultas
       WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND [status] = 'scheduled' AND consultation_date ${direction} @now AND deleted_at IS NULL
       ORDER BY consultation_date ${order}`,
      [...PATIENT_INPUT(args.pacienteId, ctx.sucursalId), { name: 'limit', type: () => sql.Int(), value: args.limit ?? 10 }, { name: 'now', type: () => sql.DateTime2(3), value: now }],
    );
    return rows;
  },
});

export const patientMetricsTool = defineTool({
  id: 'get_patient_metrics',
  name: 'Metricas operativas del paciente',
  description: 'Compone metricas operativas a nivel paciente desde el OLTP: total de consultas, adherencia reciente, paneles de laboratorio y ultimo peso registrado.',
  readOnly: true,
  riskLevel: 'medium',
  dataCategories: ['operational'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 60 * 60 * 1000,
  toolVersion: '1.0.0',
  schema: { pacienteId: uuidField('pacienteId es requerido') },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return null;
    const [consultations, adherence, labs, latestWeight, activePlan] = await Promise.all([
      execRead<{ total: number; last90: number }>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN consultation_date >= DATEADD(day, -90, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS last90
         FROM consultas WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`,
        PATIENT_INPUT(args.pacienteId, ctx.sucursalId),
      ),
      execRead<{ records: number; avg_menu: number | null }>(
        `SELECT COUNT(*) AS records, AVG(CONVERT(FLOAT, adherence_menu)) AS avg_menu
         FROM adherence_records WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL
           AND record_date >= DATEADD(day, -30, SYSUTCDATETIME())`,
        PATIENT_INPUT(args.pacienteId, ctx.sucursalId),
      ),
      execRead<{ total: number }>(
        `SELECT COUNT(*) AS total FROM lab_panels WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`,
        PATIENT_INPUT(args.pacienteId, ctx.sucursalId),
      ),
      execRead<{ weight_kg: number; measured_at: string }>(
        `SELECT TOP 1 weight_kg, measured_at FROM antropometrias WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY measured_at DESC`,
        PATIENT_INPUT(args.pacienteId, ctx.sucursalId),
      ),
      execRead<{ has_plan: number }>(
        `SELECT COUNT(*) AS has_plan FROM planes_alimenticios WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND [status] = 'active' AND deleted_at IS NULL`,
        PATIENT_INPUT(args.pacienteId, ctx.sucursalId),
      ),
    ]);
    const consultationsRow = consultations[0];
    const adherenceRow = adherence[0];
    const labsRow = labs[0];
    const weightRow = latestWeight[0];
    const planRow = activePlan[0];
    return {
      consultationsTotal: Number(consultationsRow?.total ?? 0),
      consultationsLast90Days: Number(consultationsRow?.last90 ?? 0),
      adherenceRecordsLast30Days: Number(adherenceRow?.records ?? 0),
      adherenceMenuAvgLast30Days: adherenceRow?.avg_menu !== null && adherenceRow?.avg_menu !== undefined ? Math.round(Number(adherenceRow.avg_menu) * 100) / 100 : null,
      labPanelsTotal: Number(labsRow?.total ?? 0),
      latestWeightKg: weightRow ? Number(weightRow.weight_kg) : null,
      latestWeightMeasuredAt: weightRow ? String(weightRow.measured_at) : null,
      hasActivePlan: Number(planRow?.has_plan ?? 0) > 0,
    };
  },
});

export const evolutionTool = defineTool({
  id: 'get_evolution',
  name: 'Evolucion fisica',
  description: 'Serie temporal de peso e IMC del paciente desde las antropometrias registradas (evolucion fisica). Equivalente parcial: la evolucion conductual/objetivos no tiene fuente autoritativa.',
  readOnly: true,
  riskLevel: 'high',
  dataCategories: ['clinical'],
  requiredConsent: 'ai_opt_in',
  minRole: 'nutriologa',
  maxAgeMs: 60 * 60 * 1000,
  toolVersion: '1.0.0',
  schema: { pacienteId: uuidField('pacienteId es requerido'), limit: z.number().int().min(2).max(60).optional() },
  execute: async ({ args, ctx }) => {
    const found = await assertPatientInSucursal(args.pacienteId, ctx.sucursalId);
    if (!found) return [];
    const rows = await execRead<Record<string, unknown>>(
      `SELECT TOP (@limit) measured_at, weight_kg, bmi FROM antropometrias
       WHERE paciente_id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY measured_at DESC`,
      [...PATIENT_INPUT(args.pacienteId, ctx.sucursalId), { name: 'limit', type: () => sql.Int(), value: args.limit ?? 24 }],
    );
    const series = rows.reverse().map((row) => ({
      measuredAt: String(row.measured_at),
      weightKg: Number(row.weight_kg),
      bmi: row.bmi !== null && row.bmi !== undefined ? Number(row.bmi) : null,
    }));
    const deltas =
      series.length >= 2
        ? { weightKgDelta: Math.round((series[series.length - 1].weightKg - series[0].weightKg) * 10) / 10, periodStart: series[0].measuredAt, periodEnd: series[series.length - 1].measuredAt }
        : null;
    return { series, deltas, scope: 'physical_progress_only' };
  },
});

export const ERP_TOOLS = [
  patientProfileTool,
  anthropometryTool,
  recentConsultationsTool,
  labResultsTool,
  mealPlanTool,
  adherenceSummaryTool,
  billingHistoryTool,
  searchPatientTool,
  patientHistoryTool,
  dietDetailTool,
  bodyCompositionTool,
  vitalSignsTool,
  medicationsTool,
  allergiesTool,
  intolerancesTool,
  diagnosesTool,
  clinicalNotesTool,
  documentsTool,
  appointmentsTool,
  patientMetricsTool,
  evolutionTool,
];