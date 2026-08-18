import sql from 'mssql';
import { getPool } from '../../../db/connection.js';

export const FIXTURE_UUIDS = {
  sucursalA: '11111111-1111-1111-1111-111111111111',
  sucursalB: '22222222-2222-2222-2222-222222222222',
  profesionalA: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  profesionalB: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  pacienteA1: '10000000-0000-0000-0000-000000000001',
  pacienteA2: '10000000-0000-0000-0000-000000000002',
  pacienteB1: '20000000-0000-0000-0000-000000000001',
  consulta1: 'c0000000-0000-0000-0000-000000000001',
  consulta2: 'c0000000-0000-0000-0000-000000000002',
  consultaUpcoming: 'c0000000-0000-0000-0000-000000000003',
  consultaPast: 'c0000000-0000-0000-0000-000000000004',
  plan1: 'd0000000-0000-0000-0000-000000000001',
} as const;

const FIXTURE_TABLES = [
  'consentimientos',
  'documentos',
  'historia_personal',
  'intolerancias',
  'alergias',
  'medicamentos',
  'adherence_records',
  'planes_alimenticios',
  'lab_panels',
  'antropometrias',
  'consultas',
  'pagos',
  'pacientes',
  'profesional_sucursal',
  'profesionales',
  'sucursales',
];

export async function clearRealSqlFixture(): Promise<void> {
  const pool = await getPool();
  const req = pool.request();
  for (const table of FIXTURE_TABLES) {
    await req.query(`DELETE FROM ${table}`);
  }
}

export async function seedRealSqlFixture(): Promise<void> {
  const pool = await getPool();
  const req = pool.request();
  const u = FIXTURE_UUIDS;
  const daysAgo = (days: number, dateOnly = false) => {
    const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return dateOnly ? d.toISOString().slice(0, 10) : d.toISOString();
  };

  await req.query(`
    INSERT INTO sucursales (id, nombre, direccion) VALUES
      ('${u.sucursalA}', 'Sucursal A (pruebas B061)', 'Calle Sintetica 1'),
      ('${u.sucursalB}', 'Sucursal B (pruebas B061)', 'Calle Sintetica 2');

    INSERT INTO profesionales (id, email, password_hash, nombre_completo, rol) VALUES
      ('${u.profesionalA}', 'nutri.b061.a@test.local', 'x', 'Nutri A B061', 'nutriologa'),
      ('${u.profesionalB}', 'nutri.b061.b@test.local', 'x', 'Nutri B B061', 'nutriologa');

    INSERT INTO profesional_sucursal (profesional_id, sucursal_id) VALUES
      ('${u.profesionalA}', '${u.sucursalA}'),
      ('${u.profesionalB}', '${u.sucursalB}');

    INSERT INTO pacientes (id, sucursal_id, profesional_titular_id, nombres, apellido_paterno, apellido_materno,
      fecha_nacimiento, sexo, genero, email, telefono, estado_expediente)
    VALUES
      ('${u.pacienteA1}', '${u.sucursalA}', '${u.profesionalA}', 'Maria', 'Lopez', 'Garcia', '1985-04-12', 'female', 'female', 'maria.b061@test.local', '5550000001', 'active'),
      ('${u.pacienteA2}', '${u.sucursalA}', '${u.profesionalA}', 'Juan', 'Ramirez', 'Perez', '1990-08-03', 'male', 'male', 'juan.b061@test.local', '5550000002', 'active'),
      ('${u.pacienteB1}', '${u.sucursalB}', '${u.profesionalB}', 'Rosa', 'Castillo', 'Vega', '1978-01-25', 'female', 'female', 'rosa.b061@test.local', '5550000003', 'active');

    INSERT INTO consultas (id, sucursal_id, paciente_id, profesional_id, consultation_number, consultation_date,
      [status], reason, subjective, objective, assessment, [plan], vitals_json)
    VALUES
      ('${u.consulta1}', '${u.sucursalA}', '${u.pacienteA1}', '${u.profesionalA}', 1, '${daysAgo(10)}', 'completed',
       'Control de peso', 'La paciente refiere hambre nocturna', 'PA 120/80, FC 72', 'Sobrepeso leve', 'Plan hipocalorico',
       '{"heart_rate":72,"blood_pressure_systolic":120,"blood_pressure_diastolic":80}'),
      ('${u.consulta2}', '${u.sucursalA}', '${u.pacienteA1}', '${u.profesionalA}', 2, '${daysAgo(3)}', 'completed',
       'Revision de plan', 'Mejor adherencia en el ultimo mes', 'PA 118/78', 'Evolucion favorable', 'Continuar plan',
       '{"heart_rate":70,"blood_pressure_systolic":118,"blood_pressure_diastolic":78}'),
      ('${u.consultaUpcoming}', '${u.sucursalA}', '${u.pacienteA1}', '${u.profesionalA}', 3, '${daysAgo(-7)}', 'scheduled',
       'Cita programada', NULL, NULL, NULL, NULL, NULL),
      ('${u.consultaPast}', '${u.sucursalA}', '${u.pacienteA1}', '${u.profesionalA}', 4, '${daysAgo(30)}', 'scheduled',
       'Cita pasada', NULL, NULL, NULL, NULL, NULL);

    INSERT INTO antropometrias (id, sucursal_id, paciente_id, profesional_id, measured_at, weight_kg, height_m,
      waist_cm, hip_cm, bmi, body_fat_pct, tricipital_mm)
    VALUES
      ('${u.pacienteA1}', '${u.sucursalA}', '${u.pacienteA1}', '${u.profesionalA}', '${daysAgo(5)}', 72.5, 1.62, 82, 98, 27.6, 28.4, 14.0),
      ('${u.pacienteA2}', '${u.sucursalA}', '${u.pacienteA2}', '${u.profesionalA}', '${daysAgo(400)}', 88.0, 1.75, 95, 104, 28.7, NULL, NULL),
      ('${u.pacienteB1}', '${u.sucursalB}', '${u.pacienteB1}', '${u.profesionalB}', '${daysAgo(2)}', 65.0, 1.58, 74, 92, 26.0, NULL, NULL);

    INSERT INTO lab_panels (id, sucursal_id, paciente_id, profesional_id, taken_at, lab_name, results_json, notes)
    VALUES
      ('${u.consulta1}', '${u.sucursalA}', '${u.pacienteA1}', '${u.profesionalA}', '${daysAgo(20)}', 'Panel metabolico completo',
       '{"glucosa":92,"hemoglobina":13.5,"colesterol_total":198,"hdl":52,"ldl":118,"trigliceridos":150}',
       'Sin hallazgos relevantes');

    INSERT INTO planes_alimenticios (id, sucursal_id, paciente_id, consulta_id, profesional_id, [name], description,
      start_date, end_date, kcal_target, protein_target_g, carbs_target_g, fat_target_g, meals_json, [status])
    VALUES
      ('${u.plan1}', '${u.sucursalA}', '${u.pacienteA1}', '${u.consulta1}', '${u.profesionalA}', 'Plan B061 activo',
       'Plan hipocalorico balanceado', '${daysAgo(8, true)}', NULL, 1600, 110, 160, 50,
       '[{"foodId":"fruta-manzana","foodName":"Manzana","group":"frutas","portions":1},{"foodId":"verdura-zanahoria","foodName":"Zanahoria","group":"verduras","portions":2}]',
       'active');

    INSERT INTO adherence_records (id, sucursal_id, paciente_id, consulta_id, source, record_date,
      adherence_menu, adherence_water, adherence_activity, adherence_supplements, adherence_sleep)
    VALUES
      ('${u.consulta2}', '${u.sucursalA}', '${u.pacienteA1}', '${u.consulta2}', 'consulta', '${daysAgo(2, true)}', 90, 80, 70, 100, 85),
      ('${u.consulta1}', '${u.sucursalA}', '${u.pacienteA1}', '${u.consulta1}', 'consulta', '${daysAgo(12, true)}', 75, 90, 60, 80, 90);

    INSERT INTO pagos (id, sucursal_id, paciente_id, profesional_id, fecha, monto, metodo_pago, [status])
    VALUES
      ('${u.plan1}', '${u.sucursalA}', '${u.pacienteA1}', '${u.profesionalA}', '${daysAgo(6, true)}', 850.00, 'tarjeta', 'completed');

    INSERT INTO medicamentos (id, paciente_id, nombre, dosis, frecuencia, via_administracion, fecha_inicio, motivo, activo)
    VALUES
      ('${u.consulta1}', '${u.pacienteA1}', 'Metformina', '850 mg', 'cada 12 horas', 'oral', '${daysAgo(60, true)}', 'Diabetes tipo 2', 1),
      ('${u.consulta2}', '${u.pacienteA1}', 'Omeprazol', '20 mg', 'cada 24 horas', 'oral', '${daysAgo(30, true)}', 'Reflujo', 0);

    INSERT INTO alergias (id, paciente_id, sustancia, reaccion, severidad, diagnosticada, notas)
    VALUES
      ('${u.consulta1}', '${u.pacienteA1}', 'Cacahuate', 'Urticaria', 'moderada', 1, 'Confirmada por alergologo');

    INSERT INTO intolerancias (id, paciente_id, alimento, sintomas, severidad, notas)
    VALUES
      ('${u.consulta2}', '${u.pacienteA1}', 'Lactosa', 'Distension abdominal', 'leve', NULL);

    INSERT INTO historia_personal (id, paciente_id, condicion, fecha_diagnostico, estado, tratamiento, notas)
    VALUES
      ('${u.consulta1}', '${u.pacienteA1}', 'Diabetes tipo 2', '${daysAgo(700, true)}', 'cronica', 'Metformina', NULL),
      ('${u.consulta2}', '${u.pacienteA1}', 'Hipertension', '${daysAgo(400, true)}', 'activa', 'Dieta baja en sodio', NULL);

    INSERT INTO documentos (id, paciente_id, consulta_id, profesional_id, tipo, nombre_archivo, mime_type,
      tamano_bytes, url_storage, hash_sha256, fecha_documento)
    VALUES
      ('${u.consulta1}', '${u.pacienteA1}', '${u.consulta1}', '${u.profesionalA}', 'estudio', 'laboratorio.pdf',
       'application/pdf', 204800, 'storage://sintetico/laboratorio.pdf', '${'aa'.repeat(32)}', '${daysAgo(15, true)}');

    INSERT INTO consentimientos (id, paciente_id, sucursal_id, tipo, titulo, contenido_html, version, aceptado, fecha_aceptacion)
    VALUES
      ('${u.plan1}', '${u.pacienteA1}', '${u.sucursalA}', 'datos_personales', 'Consentimiento AI (pruebas)',
       '<p>Consentimiento sintetico B061</p>', 1, 1, '${daysAgo(30)}'),
      ('d0000000-0000-0000-0000-000000000002', '${u.pacienteA2}', '${u.sucursalA}', 'datos_personales', 'Consentimiento AI (pruebas)',
       '<p>Consentimiento sintetico B061</p>', 1, 1, '${daysAgo(30)}');
  `);
}

export interface RealSqlConsentStatus {
  granted: boolean;
  verifiedVia: string;
}

export async function realSqlConsentStatus(pacienteId: string, sucursalId: string): Promise<RealSqlConsentStatus> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('paciente_id', sql.UniqueIdentifier, pacienteId)
    .input('sucursal_id', sql.UniqueIdentifier, sucursalId)
    .query(
      `SELECT TOP 1 aceptado, revocado FROM consentimientos
       WHERE paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND tipo = 'datos_personales'
         AND deleted_at IS NULL ORDER BY version DESC`,
    );
  const row = result.recordset[0];
  return { granted: Boolean(row && row.aceptado === true && row.revocado === false), verifiedVia: 'consentimientos.tipo=datos_personales' };
}

export const realSqlConsentChecker = async (pacienteId: string, sucursalId: string, _tipo: string): Promise<boolean> => {
  const status = await realSqlConsentStatus(pacienteId, sucursalId);
  return status.granted;
};

export function realSqlNow(): Date {
  return new Date();
}

export const REAL_SQL_TOOLS = [
  'search_patient',
  'patient_profile',
  'recent_consultations',
  'get_evolution',
  'meal_plan',
  'get_diet',
  'billing_history',
  'anthropometry_tool',
  'lab_results',
  'adherence_summary',
  'get_patient_history',
  'get_body_composition',
  'get_vital_signs',
  'get_medications',
  'get_allergies',
  'get_intolerances',
  'get_diagnoses',
  'get_clinical_notes',
  'get_documents',
  'get_appointments',
  'get_patient_metrics',
] as const;

export const SPEC_MATRIX_MAP: Record<string, string> = {
  get_patient_profile: 'patient_profile',
  get_patient_history: 'get_patient_history',
  get_consultations: 'recent_consultations',
  get_evolution: 'get_evolution',
  get_nutrition_plan: 'meal_plan',
  get_diet: 'get_diet',
  get_goals: 'BLOCKED',
  get_anthropometry: 'anthropometry_tool',
  get_body_composition: 'get_body_composition',
  get_vital_signs: 'get_vital_signs',
  get_lab_results: 'lab_results',
  get_medications: 'get_medications',
  get_allergies: 'get_allergies',
  get_intolerances: 'get_intolerances',
  get_diagnoses: 'get_diagnoses',
  get_clinical_notes: 'get_clinical_notes',
  get_documents: 'get_documents',
  get_appointments: 'get_appointments',
  get_alerts: 'BLOCKED',
  get_patient_metrics: 'get_patient_metrics',
  search_patient: 'search_patient',
  billing_history: 'billing_history',
};