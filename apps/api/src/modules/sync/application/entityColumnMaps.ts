/**
 * Mapping de columnas entre el schema del cliente (Dexie, inglés snake_case)
 * y el schema del servidor (SQL Server, español).
 *
 * El cliente trabaja con campos `first_name`, `last_name`, etc.; el server
 * almacena `nombres`, `apellido_paterno`, etc. La sincronización traduce
 * en ambos sentidos y convierte los tipos JS a tipos SQL Server correctos.
 *
 * Para cada columna writable se declara:
 *   - dbColumn: nombre de la columna en SQL Server (español)
 *   - sqlType: factory de mssql (sql.Int, sql.NVarChar, sql.Decimal, etc.)
 *   - nullable: si la columna acepta NULL (afecta el render del INSERT)
 *   - transform?: (v) => v — pre-procesa el valor antes de mssql
 *       (e.g. JSON.stringify para *_json, conversion de fechas,
 *        mapping de enums cliente → DB)
 *
 * WRITABLE_COLUMNS es la whitelist de columnas que el cliente puede escribir.
 * Las columnas de sistema (id, sucursal_id, row_version, created_at,
 * updated_at, deleted_at) NO están: el server las inyecta o filtra.
 */
import sql from 'mssql';
import type { SyncableEntity } from '@nutriclinica/shared';

export interface ColumnSpec {
  dbColumn: string;
  sqlType: () => sql.ISqlType;
  nullable: boolean;
  /** Pre-procesa el valor JS antes de mandarlo a mssql (write direction). */
  transform?: (value: unknown) => unknown;
  /** Post-procesa el valor crudo de la DB antes de mandarlo al cliente (read direction).
   *  Si no se especifica, el valor pasa tal cual. Útil para *_json columns: server
   *  almacena string, cliente espera objeto. */
  parse?: (value: unknown) => unknown;
}

export type EntityColumnMap = {
  /** client_field -> ColumnSpec. */
  byClientField: Readonly<Record<string, ColumnSpec>>;
  /** db_column -> ColumnSpec. Inverso (para pull). */
  byDbColumn: Readonly<Record<string, ColumnSpec>>;
  /** Set de db_columns writable (rápido lookup). */
  writableDbColumns: ReadonlySet<string>;
};

/* ----------------------------- transforms ----------------------------- */

function jsonStringify(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Inverso de `jsonStringify` para el read direction (pull).
 * El server almacena el JSON como string en columnas `*_json NVARCHAR(MAX)`.
 * El cliente espera el objeto/array. Si el valor ya es objeto (no debería
 * pasar con mssql, pero defensivo), lo pasamos tal cual. Si el parseo
 * falla (string corrupto), devolvemos el string crudo y logueamos una
 * vez por columna — preferimos no romper el pull por un campo sucio.
 */
function jsonParse(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    console.warn('[sync] jsonParse falló; devolviendo string crudo', { error: err });
    return value;
  }
}

function toDate(value: unknown): unknown {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d;
  }
  return value;
}

/**
 * El cliente usa RecordStatus = 'active' | 'inactive' | 'discharged' | 'referred'
 * (workflow clínico). El DB tiene record_status con CHECK ('open','closed')
 * (lifecycle del expediente). Mapeamos:
 *   - 'active' -> 'open'
 *   - resto -> 'closed'
 */
function recordStatusClientToDb(value: unknown): unknown {
  if (value == null) return null;
  if (value === 'active') return 'open';
  return 'closed';
}

/* ----------------------------- pacientes ----------------------------- */

const pacientesMap: EntityColumnMap = {
  byClientField: {
    profesional_titular_id: { dbColumn: 'profesional_titular_id', sqlType: () => sql.UniqueIdentifier(), nullable: true },
    first_name: { dbColumn: 'nombres', sqlType: () => sql.NVarChar(120), nullable: false },
    last_name: { dbColumn: 'apellido_paterno', sqlType: () => sql.NVarChar(80), nullable: false },
    second_last_name: { dbColumn: 'apellido_materno', sqlType: () => sql.NVarChar(80), nullable: true },
    birth_date: { dbColumn: 'fecha_nacimiento', sqlType: () => sql.Date(), nullable: false, transform: toDate },
    sex: { dbColumn: 'sexo', sqlType: () => sql.NVarChar(20), nullable: false },
    gender: { dbColumn: 'genero', sqlType: () => sql.NVarChar(80), nullable: true },
    marital_status: { dbColumn: 'estado_civil', sqlType: () => sql.NVarChar(40), nullable: true },
    occupation: { dbColumn: 'ocupacion', sqlType: () => sql.NVarChar(120), nullable: true },
    education: { dbColumn: 'escolaridad', sqlType: () => sql.NVarChar(80), nullable: true },
    email: { dbColumn: 'email', sqlType: () => sql.NVarChar(200), nullable: true },
    phone: { dbColumn: 'telefono', sqlType: () => sql.NVarChar(40), nullable: true },
    secondary_phone: { dbColumn: 'telefono_secundario', sqlType: () => sql.NVarChar(40), nullable: true },
    emergency_contact_name: { dbColumn: 'contacto_emergencia_nombre', sqlType: () => sql.NVarChar(200), nullable: true },
    emergency_contact_relationship: { dbColumn: 'contacto_emergencia_parentesco', sqlType: () => sql.NVarChar(60), nullable: true },
    emergency_contact_phone: { dbColumn: 'contacto_emergencia_telefono', sqlType: () => sql.NVarChar(40), nullable: true },
    general_notes: { dbColumn: 'notas_generales', sqlType: () => sql.NVarChar(sql.MAX), nullable: true },
    estado_expediente: { dbColumn: 'estado_expediente', sqlType: () => sql.NVarChar(20), nullable: false },
    record_opened_at: { dbColumn: 'expediente_abierto_at', sqlType: () => sql.DateTime2(), nullable: true, transform: toDate },
    consentimiento_informado_id: { dbColumn: 'consentimiento_informado_id', sqlType: () => sql.UniqueIdentifier(), nullable: true },
    fecha_firma_consentimiento: { dbColumn: 'fecha_firma_consentimiento', sqlType: () => sql.DateTime2(), nullable: true, transform: toDate },
    version_politica_privacidad: { dbColumn: 'version_politica_privacidad', sqlType: () => sql.NVarChar(40), nullable: true },
    clinical_tags: { dbColumn: 'clinical_tags_json', sqlType: () => sql.NVarChar(sql.MAX), nullable: true, transform: jsonStringify, parse: jsonParse },
    record_status: { dbColumn: 'record_status', sqlType: () => sql.NVarChar(20), nullable: false, transform: recordStatusClientToDb },
    record_closed_reason: { dbColumn: 'record_closed_reason', sqlType: () => sql.NVarChar(40), nullable: true },
    record_closed_at: { dbColumn: 'record_closed_at', sqlType: () => sql.DateTime2(), nullable: true, transform: toDate },
    status: { dbColumn: 'status', sqlType: () => sql.NVarChar(20), nullable: false },
    // Soft-delete: cascade-delete envía `update` con `deleted_at` seteado.
    // El server debe respetarlo para que la próxima pull no resucite la fila.
    deleted_at: { dbColumn: 'deleted_at', sqlType: () => sql.DateTime2(), nullable: true, transform: toDate },
  },
  byDbColumn: {},
  writableDbColumns: new Set(),
};
pacientesMap.byDbColumn = invertByClientField(pacientesMap.byClientField);
pacientesMap.writableDbColumns = new Set(Object.values(pacientesMap.byClientField).map((c) => c.dbColumn));

/* ----------------------------- consultas ----------------------------- */

const consultasMap: EntityColumnMap = {
  byClientField: {
    patient_id: { dbColumn: 'paciente_id', sqlType: () => sql.UniqueIdentifier(), nullable: false },
    profesional_id: { dbColumn: 'profesional_id', sqlType: () => sql.UniqueIdentifier(), nullable: false },
    consultation_number: { dbColumn: 'consultation_number', sqlType: () => sql.Int(), nullable: false },
    consultation_date: { dbColumn: 'consultation_date', sqlType: () => sql.DateTime2(), nullable: false, transform: toDate },
    status: { dbColumn: 'status', sqlType: () => sql.NVarChar(20), nullable: false },
    reason: { dbColumn: 'reason', sqlType: () => sql.NVarChar(500), nullable: false },
    subjective: { dbColumn: 'subjective', sqlType: () => sql.NVarChar(sql.MAX), nullable: true },
    objective: { dbColumn: 'objective', sqlType: () => sql.NVarChar(sql.MAX), nullable: true },
    assessment: { dbColumn: 'assessment', sqlType: () => sql.NVarChar(sql.MAX), nullable: true },
    plan: { dbColumn: 'plan', sqlType: () => sql.NVarChar(sql.MAX), nullable: true },
    vitals: { dbColumn: 'vitals_json', sqlType: () => sql.NVarChar(sql.MAX), nullable: true, transform: jsonStringify, parse: jsonParse },
    anthropometry_id: { dbColumn: 'anthropometry_id', sqlType: () => sql.UniqueIdentifier(), nullable: true },
    lab_panel_id: { dbColumn: 'lab_panel_id', sqlType: () => sql.UniqueIdentifier(), nullable: true },
    next_visit_date: { dbColumn: 'next_visit_date', sqlType: () => sql.Date(), nullable: true, transform: toDate },
    // Sprint 14D: campos de pago a nivel consulta (MVP).
    cost: { dbColumn: 'cost', sqlType: () => sql.Decimal(12, 2), nullable: false },
    paid: { dbColumn: 'paid', sqlType: () => sql.Bit(), nullable: false },
    payment_method: { dbColumn: 'payment_method', sqlType: () => sql.NVarChar(40), nullable: true },
    paid_at: { dbColumn: 'paid_at', sqlType: () => sql.DateTime2(), nullable: true, transform: toDate },
    reference: { dbColumn: 'reference', sqlType: () => sql.NVarChar(120), nullable: true },
    invoice_number: { dbColumn: 'invoice_number', sqlType: () => sql.NVarChar(40), nullable: true },
    billing_notes: { dbColumn: 'billing_notes', sqlType: () => sql.NVarChar(500), nullable: true },
    deleted_at: { dbColumn: 'deleted_at', sqlType: () => sql.DateTime2(), nullable: true, transform: toDate },
  },
  byDbColumn: {},
  writableDbColumns: new Set(),
};
consultasMap.byDbColumn = invertByClientField(consultasMap.byClientField);
consultasMap.writableDbColumns = new Set(Object.values(consultasMap.byClientField).map((c) => c.dbColumn));

/* -------------------------- antropometrias -------------------------- */

const antropometriasMap: EntityColumnMap = {
  byClientField: {
    patient_id: { dbColumn: 'paciente_id', sqlType: () => sql.UniqueIdentifier(), nullable: false },
    profesional_id: { dbColumn: 'profesional_id', sqlType: () => sql.UniqueIdentifier(), nullable: false },
    measured_at: { dbColumn: 'measured_at', sqlType: () => sql.DateTime2(), nullable: false, transform: toDate },
    weight_kg: { dbColumn: 'weight_kg', sqlType: () => sql.Decimal(6, 2), nullable: false },
    height_m: { dbColumn: 'height_m', sqlType: () => sql.Decimal(4, 2), nullable: false },
    waist_cm: { dbColumn: 'waist_cm', sqlType: () => sql.Decimal(5, 1), nullable: true },
    hip_cm: { dbColumn: 'hip_cm', sqlType: () => sql.Decimal(5, 1), nullable: true },
    neck_cm: { dbColumn: 'neck_cm', sqlType: () => sql.Decimal(5, 1), nullable: true },
    chest_cm: { dbColumn: 'chest_cm', sqlType: () => sql.Decimal(5, 1), nullable: true },
    arm_cm: { dbColumn: 'arm_cm', sqlType: () => sql.Decimal(5, 1), nullable: true },
    forearm_cm: { dbColumn: 'forearm_cm', sqlType: () => sql.Decimal(5, 1), nullable: true },
    thigh_cm: { dbColumn: 'thigh_cm', sqlType: () => sql.Decimal(5, 1), nullable: true },
    calf_cm: { dbColumn: 'calf_cm', sqlType: () => sql.Decimal(5, 1), nullable: true },
    tricipital_mm: { dbColumn: 'tricipital_mm', sqlType: () => sql.Decimal(4, 1), nullable: true },
    bicipital_mm: { dbColumn: 'bicipital_mm', sqlType: () => sql.Decimal(4, 1), nullable: true },
    subescapular_mm: { dbColumn: 'subescapular_mm', sqlType: () => sql.Decimal(4, 1), nullable: true },
    suprailiaco_mm: { dbColumn: 'suprailiaco_mm', sqlType: () => sql.Decimal(4, 1), nullable: true },
    abdominal_mm: { dbColumn: 'abdominal_mm', sqlType: () => sql.Decimal(4, 1), nullable: true },
    muslo_mm: { dbColumn: 'muslo_mm', sqlType: () => sql.Decimal(4, 1), nullable: true },
    pantorrilla_mm: { dbColumn: 'pantorrilla_mm', sqlType: () => sql.Decimal(4, 1), nullable: true },
    bmi: { dbColumn: 'bmi', sqlType: () => sql.Decimal(5, 2), nullable: true },
    body_fat_pct: { dbColumn: 'body_fat_pct', sqlType: () => sql.Decimal(4, 1), nullable: true },
    notes: { dbColumn: 'notes', sqlType: () => sql.NVarChar(sql.MAX), nullable: true },
    deleted_at: { dbColumn: 'deleted_at', sqlType: () => sql.DateTime2(), nullable: true, transform: toDate },
  },
  byDbColumn: {},
  writableDbColumns: new Set(),
};
antropometriasMap.byDbColumn = invertByClientField(antropometriasMap.byClientField);
antropometriasMap.writableDbColumns = new Set(Object.values(antropometriasMap.byClientField).map((c) => c.dbColumn));

/* ----------------------------- lab_panels ----------------------------- */

const labPanelsMap: EntityColumnMap = {
  byClientField: {
    patient_id: { dbColumn: 'paciente_id', sqlType: () => sql.UniqueIdentifier(), nullable: false },
    profesional_id: { dbColumn: 'profesional_id', sqlType: () => sql.UniqueIdentifier(), nullable: false },
    taken_at: { dbColumn: 'taken_at', sqlType: () => sql.DateTime2(), nullable: false, transform: toDate },
    lab_name: { dbColumn: 'lab_name', sqlType: () => sql.NVarChar(200), nullable: true },
    results: { dbColumn: 'results_json', sqlType: () => sql.NVarChar(sql.MAX), nullable: false, transform: jsonStringify, parse: jsonParse },
    notes: { dbColumn: 'notes', sqlType: () => sql.NVarChar(sql.MAX), nullable: true },
    deleted_at: { dbColumn: 'deleted_at', sqlType: () => sql.DateTime2(), nullable: true, transform: toDate },
  },
  byDbColumn: {},
  writableDbColumns: new Set(),
};
labPanelsMap.byDbColumn = invertByClientField(labPanelsMap.byClientField);
labPanelsMap.writableDbColumns = new Set(Object.values(labPanelsMap.byClientField).map((c) => c.dbColumn));

/* ------------------------- planes_alimenticios ------------------------- */

const planesMap: EntityColumnMap = {
  byClientField: {
    patient_id: { dbColumn: 'paciente_id', sqlType: () => sql.UniqueIdentifier(), nullable: false },
    consulta_id: { dbColumn: 'consulta_id', sqlType: () => sql.UniqueIdentifier(), nullable: false },
    profesional_id: { dbColumn: 'profesional_id', sqlType: () => sql.UniqueIdentifier(), nullable: false },
    name: { dbColumn: 'name', sqlType: () => sql.NVarChar(200), nullable: false },
    description: { dbColumn: 'description', sqlType: () => sql.NVarChar(500), nullable: true },
    start_date: { dbColumn: 'start_date', sqlType: () => sql.Date(), nullable: false, transform: toDate },
    end_date: { dbColumn: 'end_date', sqlType: () => sql.Date(), nullable: true, transform: toDate },
    kcal_target: { dbColumn: 'kcal_target', sqlType: () => sql.Int(), nullable: false },
    protein_target_g: { dbColumn: 'protein_target_g', sqlType: () => sql.Int(), nullable: false },
    carbs_target_g: { dbColumn: 'carbs_target_g', sqlType: () => sql.Int(), nullable: false },
    fat_target_g: { dbColumn: 'fat_target_g', sqlType: () => sql.Int(), nullable: false },
    meals: { dbColumn: 'meals_json', sqlType: () => sql.NVarChar(sql.MAX), nullable: false, transform: jsonStringify, parse: jsonParse },
    notes: { dbColumn: 'notes', sqlType: () => sql.NVarChar(sql.MAX), nullable: true },
    status: { dbColumn: 'status', sqlType: () => sql.NVarChar(20), nullable: false },
    deleted_at: { dbColumn: 'deleted_at', sqlType: () => sql.DateTime2(), nullable: true, transform: toDate },
  },
  byDbColumn: {},
  writableDbColumns: new Set(),
};
planesMap.byDbColumn = invertByClientField(planesMap.byClientField);
planesMap.writableDbColumns = new Set(Object.values(planesMap.byClientField).map((c) => c.dbColumn));

/* ------------------------- adherence_records ------------------------- */

const adherenceRecordsMap: EntityColumnMap = {
  byClientField: {
    patient_id: { dbColumn: 'paciente_id', sqlType: () => sql.UniqueIdentifier(), nullable: false },
    consultation_id: { dbColumn: 'consulta_id', sqlType: () => sql.UniqueIdentifier(), nullable: true },
    source: { dbColumn: 'source', sqlType: () => sql.NVarChar(20), nullable: false },
    date: { dbColumn: 'record_date', sqlType: () => sql.Date(), nullable: false, transform: toDate },
    adherence_menu: { dbColumn: 'adherence_menu', sqlType: () => sql.Decimal(5, 2), nullable: false },
    adherence_water: { dbColumn: 'adherence_water', sqlType: () => sql.Decimal(5, 2), nullable: false },
    adherence_activity: { dbColumn: 'adherence_activity', sqlType: () => sql.Decimal(5, 2), nullable: false },
    adherence_supplements: { dbColumn: 'adherence_supplements', sqlType: () => sql.Decimal(5, 2), nullable: false },
    adherence_sleep: { dbColumn: 'adherence_sleep', sqlType: () => sql.Decimal(5, 2), nullable: false },
    hunger_avg: { dbColumn: 'hunger_avg', sqlType: () => sql.Decimal(4, 1), nullable: true },
    satiety_avg: { dbColumn: 'satiety_avg', sqlType: () => sql.Decimal(4, 1), nullable: true },
    mood_avg: { dbColumn: 'mood_avg', sqlType: () => sql.Decimal(4, 1), nullable: true },
    energy_avg: { dbColumn: 'energy_avg', sqlType: () => sql.Decimal(4, 1), nullable: true },
    intercurrent_events: { dbColumn: 'intercurrent_events', sqlType: () => sql.NVarChar(1000), nullable: false },
    barriers: { dbColumn: 'barriers', sqlType: () => sql.NVarChar(1000), nullable: false },
    facilitators: { dbColumn: 'facilitators', sqlType: () => sql.NVarChar(1000), nullable: false },
    meals_logged: { dbColumn: 'meals_logged', sqlType: () => sql.NVarChar(2000), nullable: false },
    notes: { dbColumn: 'notes', sqlType: () => sql.NVarChar(2000), nullable: false },
    submitted_by_token_id: { dbColumn: 'submitted_by_token_id', sqlType: () => sql.UniqueIdentifier(), nullable: true },
    deleted_at: { dbColumn: 'deleted_at', sqlType: () => sql.DateTime2(), nullable: true, transform: toDate },
  },
  byDbColumn: {},
  writableDbColumns: new Set(),
};
adherenceRecordsMap.byDbColumn = invertByClientField(adherenceRecordsMap.byClientField);
adherenceRecordsMap.writableDbColumns = new Set(Object.values(adherenceRecordsMap.byClientField).map((c) => c.dbColumn));

/* ----------------------------- registry ----------------------------- */

function invertByClientField(byClient: Readonly<Record<string, ColumnSpec>>): Readonly<Record<string, ColumnSpec>> {
  const out: Record<string, ColumnSpec> = {};
  for (const spec of Object.values(byClient)) {
    out[spec.dbColumn] = spec;
  }
  return out;
}

const MAPS: Record<SyncableEntity, EntityColumnMap> = {
  pacientes: pacientesMap,
  consultas: consultasMap,
  antropometrias: antropometriasMap,
  lab_panels: labPanelsMap,
  planes_alimenticios: planesMap,
  adherence_records: adherenceRecordsMap,
};

export function getColumnMap(entity: SyncableEntity): EntityColumnMap {
  const map = MAPS[entity];
  if (!map) throw new Error(`No column map for entity: ${entity}`);
  return map;
}

/**
 * Convierte un payload del cliente en un array ordenado de
 * { dbColumn, sqlType, nullable, value } listo para construir un
 * INSERT o UPDATE parametrizado.
 *
 * Aplica el `transform` declarado por columna. Omite columnas con valor
 * `undefined` o cuyo dbColumn no esté en el writable set.
 */
export interface PreparedColumn {
  dbColumn: string;
  sqlType: () => sql.ISqlType;
  nullable: boolean;
  value: unknown;
}

export function prepareColumnsForWrite(
  entity: SyncableEntity,
  payload: unknown,
): PreparedColumn[] {
  const map = getColumnMap(entity);
  if (!payload || typeof payload !== 'object') return [];
  const src = payload as Record<string, unknown>;
  const out: PreparedColumn[] = [];
  for (const [clientField, spec] of Object.entries(map.byClientField)) {
    if (!(clientField in src)) continue;
    const raw = src[clientField];
    if (raw === undefined) continue;
    const value = spec.transform ? spec.transform(raw) : raw;
    out.push({
      dbColumn: spec.dbColumn,
      sqlType: spec.sqlType,
      nullable: spec.nullable,
      value: value === undefined ? null : value,
    });
  }
  return out;
}

/**
 * Helper de retro-compatibilidad: devuelve un objeto con claves = db_columns
 * y valores ya transformados. Útil para tests o para casos donde solo se
 * necesita el mapeo sin los tipos SQL.
 */
export function clientPayloadToDb(
  entity: SyncableEntity,
  payload: unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of prepareColumnsForWrite(entity, payload)) {
    out[col.dbColumn] = col.value;
  }
  return out;
}

/**
 * Traduce una fila de la DB (columnas en español) a un objeto con campos
 * del cliente (inglés snake_case). Usado en pull para que el `table.put()`
 * del cliente reciba la forma que espera.
 */
const SYSTEM_PASSTHROUGH_COLUMNS: ReadonlySet<string> = new Set([
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
]);

export function dbRowToClient(entity: SyncableEntity, row: Record<string, unknown>): Record<string, unknown> {
  const map = getColumnMap(entity);
  const out: Record<string, unknown> = {};
  // writable columns: renombrar de DB a cliente
  for (const spec of Object.values(map.byClientField)) {
    if (!(spec.dbColumn in row)) continue;
    const clientField = Object.entries(map.byClientField).find(([, s]) => s.dbColumn === spec.dbColumn)?.[0];
    if (clientField) {
      const raw = row[spec.dbColumn];
      out[clientField] = spec.parse ? spec.parse(raw) : raw;
    }
  }
  // system columns: pasar tal cual
  for (const dbCol of SYSTEM_PASSTHROUGH_COLUMNS) {
    if (dbCol in row) out[dbCol] = row[dbCol];
  }
  return out;
}
