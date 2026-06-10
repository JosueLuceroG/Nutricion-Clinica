import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Router as ExpressRouter, type NextFunction, type Request, type Response, type Router } from 'express';
import sql from 'mssql';
import { z } from 'zod';
import { getPool } from '../../db/connection.js';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';
import { ForbiddenError } from '../../middleware/errorHandler.js';
import { sendEmail, logEmailSent, renderTemplate } from '../../services/email/emailService.js';

const router: Router = ExpressRouter();

const PortalTokenParam = z
  .string()
  .min(32)
  .max(256)
  .regex(/^[A-Za-z0-9._~-]+$/);

const PortalScopeSchema = z.enum(['summary', 'plan', 'appointments', 'documents', 'adherence', 'messaging', 'meal_photos']);
type PortalScope = z.infer<typeof PortalScopeSchema>;

const DEFAULT_SCOPES: PortalScope[] = ['summary', 'plan', 'appointments', 'documents', 'adherence', 'messaging', 'meal_photos'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MEAL_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_MEAL_PHOTO_DATA_URL_LENGTH = 3_000_100;
const MEAL_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const PortalScoreSchema = z.number().finite().min(0).max(100);
const PortalRatingSchema = z.number().finite().min(1).max(10).optional().nullable();

const PortalTokenCreateBody = z.object({
  pacienteId: z.string().uuid(),
  label: z.string().trim().min(1).max(120).optional().nullable(),
  expiresInDays: z.number().int().min(1).max(365).default(30),
  scopes: z.array(PortalScopeSchema).min(1).default(DEFAULT_SCOPES),
});

const PortalAdherenceBody = z.object({
  date: z.string().regex(DATE_ONLY_REGEX).optional(),
  adherenceMenu: PortalScoreSchema,
  adherenceWater: PortalScoreSchema,
  adherenceActivity: PortalScoreSchema,
  adherenceSupplements: PortalScoreSchema,
  adherenceSleep: PortalScoreSchema,
  hungerAvg: PortalRatingSchema,
  satietyAvg: PortalRatingSchema,
  moodAvg: PortalRatingSchema,
  energyAvg: PortalRatingSchema,
  intercurrentEvents: z.string().trim().max(1000).optional().default(''),
  barriers: z.string().trim().max(1000).optional().default(''),
  facilitators: z.string().trim().max(1000).optional().default(''),
  mealsLogged: z.string().trim().max(2000).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
});

const PortalMealPhotoBody = z.object({
  mealDate: z.string().regex(DATE_ONLY_REGEX).optional(),
  mealSlot: z.string().trim().min(1).max(50),
  caption: z.string().trim().max(1000).optional().default(''),
  adherenceRating: z.number().int().min(1).max(5),
  fileName: z.string().trim().min(1).max(180).optional().default('meal-photo'),
  photoDataUrl: z.string().min(20).max(MAX_MEAL_PHOTO_DATA_URL_LENGTH),
});

interface PortalAccessRow {
  token_id: string;
  sucursal_id: string;
  paciente_id: string;
  expires_at: Date;
  scopes_json: string | null;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  fecha_nacimiento: Date;
  sexo: string;
  email: string | null;
  telefono: string | null;
  updated_at: Date;
}

interface PortalPlanRow {
  id: string;
  name: string;
  description: string | null;
  start_date: Date;
  end_date: Date | null;
  kcal_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  meals_json: string | null;
  notes: string | null;
  status: string;
  updated_at: Date;
}

interface PortalConsultationRow {
  id: string;
  consultation_date: Date;
  status: string;
  reason: string;
  next_visit_date: Date | null;
}

interface PortalDocumentRow {
  id: string;
  tipo: string;
  nombre_archivo: string;
  mime_type: string;
  tamano_bytes: number;
  url_storage: string;
  hash_sha256: string;
  fecha_documento: Date | null;
  notas: string | null;
  created_at: Date;
}

interface PortalTokenRow {
  id: string;
  sucursal_id: string;
  paciente_id: string;
  label: string | null;
  scopes_json: string | null;
  expires_at: Date;
  revoked_at: Date | null;
  last_accessed_at: Date | null;
  created_by_profesional_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PortalAuditEventRow {
  id: string;
  token_id: string;
  sucursal_id: string;
  paciente_id: string;
  profesional_id: string | null;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  details_json: string | null;
  occurred_at: Date;
}

interface PortalAdherenceRecordRow {
  id: string;
  sucursal_id: string;
  paciente_id: string;
  consulta_id: string | null;
  source: string;
  record_date: Date;
  adherence_menu: number;
  adherence_water: number;
  adherence_activity: number;
  adherence_supplements: number;
  adherence_sleep: number;
  hunger_avg: number | null;
  satiety_avg: number | null;
  mood_avg: number | null;
  energy_avg: number | null;
  intercurrent_events: string;
  barriers: string;
  facilitators: string;
  meals_logged: string;
  notes: string;
  submitted_by_token_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PortalMessageRow {
  id: string;
  token_id: string;
  paciente_id: string;
  sucursal_id: string;
  profesional_id: string | null;
  content: string;
  direction: 'patient_to_professional' | 'professional_to_patient';
  read_at: Date | null;
  created_at: Date;
}

interface PortalMealPhotoRow {
  id: string;
  token_id: string;
  paciente_id: string;
  sucursal_id: string;
  meal_date: Date;
  meal_slot: string;
  caption: string;
  adherence_rating: number;
  mime_type: string;
  file_name: string;
  size_bytes: number;
  sha256: string;
  photo_bytes?: Buffer;
  reviewed_at: Date | null;
  reviewed_by_profesional_id: string | null;
  created_at: Date;
  updated_at: Date;
}

type PortalAuditEventType =
  | 'created'
  | 'revoked'
  | 'accessed'
  | 'adherence_submitted'
  | 'document_downloaded'
  | 'message_sent'
  | 'meal_photo_submitted'
  | 'meal_photo_reviewed';

interface PortalMealExchange {
  foodId: string;
  count: number;
}

interface PortalMeal {
  slot: string;
  exchanges: PortalMealExchange[];
}

export function hashPortalToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generatePortalToken(): string {
  return randomBytes(32).toString('hex');
}

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function parsePortalScopes(raw: string | null | undefined): PortalScope[] {
  if (!raw) return DEFAULT_SCOPES;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = z.array(PortalScopeSchema).safeParse(parsed);
    return result.success ? Array.from(new Set(result.data)) : [];
  } catch {
    return [];
  }
}

export function parsePortalMeals(raw: string | null | undefined): PortalMeal[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = z
      .array(
        z.object({
          slot: z.string().min(1),
          exchanges: z
            .array(
              z.object({
                foodId: z.string().min(1),
                count: z.number().finite().positive(),
              }),
            )
            .default([]),
        }),
      )
      .safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function dateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function dateFromDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

function fullName(row: Pick<PortalAccessRow, 'nombres' | 'apellido_paterno' | 'apellido_materno'>): string {
  return [row.nombres, row.apellido_paterno, row.apellido_materno].filter(Boolean).join(' ');
}

function notFound(res: Response): void {
  res.status(404).json({ error: 'Portal no encontrado o expirado' });
}

function canManagePortalTokens(rol: string): boolean {
  return ['admin', 'nutriologa'].includes(rol);
}

function portalTokenStatus(row: Pick<PortalTokenRow, 'expires_at' | 'revoked_at'>): 'active' | 'expired' | 'revoked' {
  if (row.revoked_at) return 'revoked';
  return row.expires_at.getTime() <= Date.now() ? 'expired' : 'active';
}

function rowToPortalToken(row: PortalTokenRow, recentEvents: PortalAuditEventRow[] = []): Record<string, unknown> {
  return {
    id: row.id,
    sucursalId: row.sucursal_id,
    pacienteId: row.paciente_id,
    label: row.label,
    scopes: parsePortalScopes(row.scopes_json),
    expiresAt: iso(row.expires_at),
    revokedAt: iso(row.revoked_at),
    lastAccessedAt: iso(row.last_accessed_at),
    createdByProfesionalId: row.created_by_profesional_id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    status: portalTokenStatus(row),
    recentEvents: recentEvents.map(rowToPortalAuditEvent),
  };
}

function rowToPortalAuditEvent(row: PortalAuditEventRow): Record<string, unknown> {
  return {
    id: row.id,
    tokenId: row.token_id,
    sucursalId: row.sucursal_id,
    pacienteId: row.paciente_id,
    profesionalId: row.profesional_id,
    type: row.event_type,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    details: parseAuditDetails(row.details_json),
    occurredAt: iso(row.occurred_at),
  };
}

function rowToPortalAdherenceRecord(row: PortalAdherenceRecordRow): Record<string, unknown> {
  return {
    id: row.id,
    sucursalId: row.sucursal_id,
    pacienteId: row.paciente_id,
    consultationId: row.consulta_id,
    source: row.source,
    date: dateOnly(row.record_date),
    adherenceMenu: Number(row.adherence_menu),
    adherenceWater: Number(row.adherence_water),
    adherenceActivity: Number(row.adherence_activity),
    adherenceSupplements: Number(row.adherence_supplements),
    adherenceSleep: Number(row.adherence_sleep),
    hungerAvg: row.hunger_avg === null ? null : Number(row.hunger_avg),
    satietyAvg: row.satiety_avg === null ? null : Number(row.satiety_avg),
    moodAvg: row.mood_avg === null ? null : Number(row.mood_avg),
    energyAvg: row.energy_avg === null ? null : Number(row.energy_avg),
    intercurrentEvents: row.intercurrent_events,
    barriers: row.barriers,
    facilitators: row.facilitators,
    mealsLogged: row.meals_logged,
    notes: row.notes,
    submittedByTokenId: row.submitted_by_token_id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function rowToPortalMealPhoto(row: PortalMealPhotoRow): Record<string, unknown> {
  return {
    id: row.id,
    tokenId: row.token_id,
    pacienteId: row.paciente_id,
    sucursalId: row.sucursal_id,
    mealDate: dateOnly(row.meal_date),
    mealSlot: row.meal_slot,
    caption: row.caption,
    adherenceRating: Number(row.adherence_rating),
    mimeType: row.mime_type,
    fileName: row.file_name,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    reviewedAt: iso(row.reviewed_at),
    reviewedByProfesionalId: row.reviewed_by_profesional_id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function rowToPortalMessage(row: PortalMessageRow): Record<string, unknown> {
  return {
    id: row.id,
    tokenId: row.token_id,
    pacienteId: row.paciente_id,
    sucursalId: row.sucursal_id,
    profesionalId: row.profesional_id,
    content: row.content,
    direction: row.direction,
    readAt: iso(row.read_at),
    createdAt: iso(row.created_at),
  };
}

function parseMealPhotoDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const mimeType = match[1]!;
  if (!MEAL_PHOTO_MIME_TYPES.has(mimeType)) return null;
  const buffer = Buffer.from(match[2]!, 'base64');
  if (buffer.length <= 0 || buffer.length > MAX_MEAL_PHOTO_BYTES) return null;
  return { mimeType, buffer };
}

function extensionForMealPhoto(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function sanitizeMealPhotoFileName(input: string, mimeType: string): string {
  const ext = extensionForMealPhoto(mimeType);
  const base = input.split(/[\\/]/).pop()?.trim() || `meal-photo.${ext}`;
  const safe = base.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 160) || `meal-photo.${ext}`;
  return /\.(jpe?g|png|webp)$/i.test(safe) ? safe : `${safe}.${ext}`;
}

function parseAuditDetails(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function operationForAudit(eventType: PortalAuditEventType): 'create' | 'read' | 'update' {
  if (eventType === 'created') return 'create';
  if (eventType === 'adherence_submitted') return 'create';
  if (eventType === 'message_sent') return 'create';
  if (eventType === 'meal_photo_submitted') return 'create';
  if (eventType === 'revoked') return 'update';
  if (eventType === 'meal_photo_reviewed') return 'update';
  return 'read';
}

function clientIp(req: Request): string | null {
  const forwarded = req.header('x-forwarded-for');
  if (forwarded?.trim()) return forwarded.split(',')[0]!.trim().slice(0, 45);
  const ip = req.ip || req.socket.remoteAddress;
  return ip ? ip.slice(0, 45) : null;
}

function userAgent(req: Request): string | null {
  return req.get('user-agent')?.slice(0, 500) ?? null;
}

async function recordPortalAudit(
  pool: sql.ConnectionPool,
  input: {
    tokenId: string;
    sucursalId: string;
    pacienteId: string;
    profesionalId?: string | null;
    eventType: PortalAuditEventType;
    req: Request;
    details?: Record<string, unknown>;
    auditEntityType?: string;
    auditEntityId?: string;
    auditOperation?: 'create' | 'read' | 'update';
  },
): Promise<void> {
  const eventId = randomUUID();
  const auditLogId = randomUUID();
  const detailsJson = JSON.stringify({
    ...(input.details ?? {}),
    portalAuditEventId: eventId,
    eventType: input.eventType,
    tokenId: input.tokenId,
    pacienteId: input.pacienteId,
  });
  const ip = clientIp(input.req);
  const ua = userAgent(input.req);
  const auditEntityType = input.auditEntityType ?? 'patient_portal_token';
  const auditEntityId = input.auditEntityId ?? input.tokenId;
  const auditOperation = input.auditOperation ?? operationForAudit(input.eventType);

  await pool
    .request()
    .input('id', sql.UniqueIdentifier(), eventId)
    .input('token_id', sql.UniqueIdentifier(), input.tokenId)
    .input('sucursal_id', sql.UniqueIdentifier(), input.sucursalId)
    .input('paciente_id', sql.UniqueIdentifier(), input.pacienteId)
    .input('profesional_id', sql.UniqueIdentifier(), input.profesionalId ?? null)
    .input('event_type', sql.NVarChar(40), input.eventType)
    .input('ip_address', sql.NVarChar(45), ip)
    .input('user_agent', sql.NVarChar(500), ua)
    .input('details_json', sql.NVarChar(sql.MAX), detailsJson)
    .query(
      `INSERT INTO patient_portal_audit_events
         (id, token_id, sucursal_id, paciente_id, profesional_id, event_type, ip_address, user_agent, details_json)
       VALUES
         (@id, @token_id, @sucursal_id, @paciente_id, @profesional_id, @event_type, @ip_address, @user_agent, @details_json)`,
    );

  await pool
    .request()
    .input('id', sql.UniqueIdentifier(), auditLogId)
    .input('sucursal_id', sql.UniqueIdentifier(), input.sucursalId)
    .input('profesional_id', sql.UniqueIdentifier(), input.profesionalId ?? null)
    .input('entity_type', sql.NVarChar(60), auditEntityType)
    .input('entity_id', sql.UniqueIdentifier(), auditEntityId)
    .input('operacion', sql.NVarChar(20), auditOperation)
    .input('detalles', sql.NVarChar(sql.MAX), detailsJson)
    .input('ip_address', sql.NVarChar(45), ip)
    .input('user_agent', sql.NVarChar(500), ua)
    .query(
      `INSERT INTO audit_log
         (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
       VALUES
         (@id, @sucursal_id, @profesional_id, @entity_type, @entity_id, @operacion, @detalles, @ip_address, @user_agent)`,
    );
}

async function loadPortalAccess(pool: sql.ConnectionPool, token: string): Promise<PortalAccessRow | null> {
  const tokenHash = hashPortalToken(token);
  const accessResult = await pool
    .request()
    .input('token_hash', sql.NVarChar(64), tokenHash)
    .query<PortalAccessRow>(
      `SELECT TOP 1
         ppt.id AS token_id, ppt.sucursal_id, ppt.paciente_id, ppt.expires_at, ppt.scopes_json,
         p.nombres, p.apellido_paterno, p.apellido_materno, p.fecha_nacimiento,
         p.sexo, p.email, p.telefono, p.updated_at
       FROM patient_portal_tokens ppt
       INNER JOIN pacientes p
          ON p.id = ppt.paciente_id
         AND p.sucursal_id = ppt.sucursal_id
         AND p.deleted_at IS NULL
       WHERE ppt.token_hash = @token_hash
         AND ppt.revoked_at IS NULL
         AND ppt.expires_at > SYSUTCDATETIME()
       ORDER BY ppt.expires_at DESC`,
    );
  return accessResult.recordset[0] ?? null;
}

async function touchPortalToken(pool: sql.ConnectionPool, tokenId: string): Promise<void> {
  await pool
    .request()
    .input('token_id', sql.UniqueIdentifier(), tokenId)
    .query(`UPDATE patient_portal_tokens SET last_accessed_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME() WHERE id = @token_id`);
}

router.get('/tokens', requireAuth, requireSucursalAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pacienteId = typeof req.query.pacienteId === 'string' ? req.query.pacienteId : '';
    if (!isUuid(pacienteId)) {
      res.status(400).json({ error: 'pacienteId debe ser UUID' });
      return;
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input('sucursal_id', sql.UniqueIdentifier(), String(req.sucursalId))
      .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
      .query<PortalTokenRow>(
        `SELECT id, sucursal_id, paciente_id, label, scopes_json, expires_at, revoked_at,
                last_accessed_at, created_by_profesional_id, created_at, updated_at
           FROM patient_portal_tokens
          WHERE sucursal_id = @sucursal_id
            AND paciente_id = @paciente_id
          ORDER BY created_at DESC`,
      );
    const auditResult = await pool
      .request()
      .input('sucursal_id', sql.UniqueIdentifier(), String(req.sucursalId))
      .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
      .query<PortalAuditEventRow>(
        `SELECT TOP 50 id, token_id, sucursal_id, paciente_id, profesional_id, event_type,
                ip_address, user_agent, details_json, occurred_at
           FROM patient_portal_audit_events
          WHERE sucursal_id = @sucursal_id
            AND paciente_id = @paciente_id
          ORDER BY occurred_at DESC`,
      );
    const eventsByToken = new Map<string, PortalAuditEventRow[]>();
    for (const event of auditResult.recordset) {
      const list = eventsByToken.get(event.token_id) ?? [];
      if (list.length < 5) list.push(event);
      eventsByToken.set(event.token_id, list);
    }
    res.json({ tokens: result.recordset.map((row) => rowToPortalToken(row, eventsByToken.get(row.id))) });
  } catch (err) {
    next(err);
  }
});

router.post('/tokens', requireAuth, requireSucursalAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !canManagePortalTokens(req.user.rol)) {
      throw new ForbiddenError('Rol sin permisos para gestionar enlaces del portal');
    }

    const body = PortalTokenCreateBody.parse(req.body);
    const sucursalId = String(req.sucursalId);
    const pool = await getPool();
    const patient = await pool
      .request()
      .input('paciente_id', sql.UniqueIdentifier(), body.pacienteId)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<{ id: string }>(
        `SELECT id FROM pacientes
          WHERE id = @paciente_id
            AND sucursal_id = @sucursal_id
            AND deleted_at IS NULL`,
      );
    if (patient.recordset.length === 0) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }

    const id = randomUUID();
    const token = generatePortalToken();
    const tokenHash = hashPortalToken(token);
    const expiresAt = new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000);
    const scopes = Array.from(new Set(body.scopes));
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .input('paciente_id', sql.UniqueIdentifier(), body.pacienteId)
      .input('token_hash', sql.NVarChar(64), tokenHash)
      .input('label', sql.NVarChar(120), body.label ?? null)
      .input('scopes_json', sql.NVarChar(sql.MAX), JSON.stringify(scopes))
      .input('expires_at', sql.DateTime2(), expiresAt)
      .input('created_by_profesional_id', sql.UniqueIdentifier(), req.user.sub)
      .query(
        `INSERT INTO patient_portal_tokens
           (id, sucursal_id, paciente_id, token_hash, label, scopes_json, expires_at, created_by_profesional_id)
         VALUES
           (@id, @sucursal_id, @paciente_id, @token_hash, @label, @scopes_json, @expires_at, @created_by_profesional_id)`,
      );

    await recordPortalAudit(pool, {
      tokenId: id,
      sucursalId,
      pacienteId: body.pacienteId,
      profesionalId: req.user.sub,
      eventType: 'created',
      req,
      details: { label: body.label ?? null, scopes, expiresAt: expiresAt.toISOString() },
    });

    res.status(201).json({
      token,
      portalPath: `/portal/${token}`,
      link: {
        id,
        sucursalId,
        pacienteId: body.pacienteId,
        label: body.label ?? null,
        scopes,
        expiresAt: expiresAt.toISOString(),
        revokedAt: null,
        lastAccessedAt: null,
        createdByProfesionalId: req.user.sub,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active',
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/adherence', requireAuth, requireSucursalAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pacienteId = typeof req.query.pacienteId === 'string' ? req.query.pacienteId : '';
    if (!isUuid(pacienteId)) {
      res.status(400).json({ error: 'pacienteId debe ser UUID' });
      return;
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input('sucursal_id', sql.UniqueIdentifier(), String(req.sucursalId))
      .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
      .query<PortalAdherenceRecordRow>(
        `SELECT id, sucursal_id, paciente_id, consulta_id, source, record_date,
                adherence_menu, adherence_water, adherence_activity, adherence_supplements,
                adherence_sleep, hunger_avg, satiety_avg, mood_avg, energy_avg,
                intercurrent_events, barriers, facilitators, meals_logged, notes,
                submitted_by_token_id, created_at, updated_at
           FROM adherence_records
          WHERE sucursal_id = @sucursal_id
            AND paciente_id = @paciente_id
            AND deleted_at IS NULL
          ORDER BY record_date DESC, created_at DESC`,
      );

    res.json({ records: result.recordset.map(rowToPortalAdherenceRecord) });
  } catch (err) {
    next(err);
  }
});

// ─── Protected: Professional messaging ─────────────────────────

router.get('/messages', requireAuth, requireSucursalAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pacienteId = typeof req.query.pacienteId === 'string' ? req.query.pacienteId : '';
    if (!isUuid(pacienteId)) {
      res.status(400).json({ error: 'pacienteId debe ser UUID' });
      return;
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input('sucursal_id', sql.UniqueIdentifier(), String(req.sucursalId))
      .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
      .query<PortalMessageRow>(
        `SELECT id, token_id, paciente_id, sucursal_id, profesional_id, content, direction, read_at, created_at
           FROM patient_portal_messages
          WHERE sucursal_id = @sucursal_id
            AND paciente_id = @paciente_id
          ORDER BY created_at ASC`,
      );

    res.json({ messages: result.recordset.map(rowToPortalMessage) });
  } catch (err) {
    next(err);
  }
});

router.post('/messages', requireAuth, requireSucursalAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !canManagePortalTokens(req.user.rol)) {
      throw new ForbiddenError('Rol sin permisos para enviar mensajes');
    }

    const MessageSendBody = z.object({
      pacienteId: z.string().uuid(),
      content: z.string().trim().min(1).max(2000),
    });
    const body = MessageSendBody.parse(req.body);
    const sucursalId = String(req.sucursalId);
    const pool = await getPool();

    const tokenResult = await pool
      .request()
      .input('paciente_id', sql.UniqueIdentifier(), body.pacienteId)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<{ id: string }>(
        `SELECT TOP 1 id
           FROM patient_portal_tokens
          WHERE paciente_id = @paciente_id
            AND sucursal_id = @sucursal_id
            AND revoked_at IS NULL
            AND expires_at > SYSUTCDATETIME()
          ORDER BY created_at DESC`,
      );
    const tokenId = tokenResult.recordset[0]?.id ?? null;
    if (!tokenId) {
      res.status(400).json({ error: 'El paciente no tiene enlace activo del portal' });
      return;
    }

    const id = randomUUID();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('token_id', sql.UniqueIdentifier(), tokenId)
      .input('paciente_id', sql.UniqueIdentifier(), body.pacienteId)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .input('profesional_id', sql.UniqueIdentifier(), req.user.sub)
      .input('content', sql.NVarChar(2000), body.content)
      .input('direction', sql.NVarChar(30), 'professional_to_patient')
      .query(
        `INSERT INTO patient_portal_messages
           (id, token_id, paciente_id, sucursal_id, profesional_id, content, direction)
         VALUES
           (@id, @token_id, @paciente_id, @sucursal_id, @profesional_id, @content, @direction)`,
      );

    const created = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .query<PortalMessageRow>(
        `SELECT id, token_id, paciente_id, sucursal_id, profesional_id, content, direction, read_at, created_at
           FROM patient_portal_messages
          WHERE id = @id`,
      );

    await recordPortalAudit(pool, {
      tokenId,
      sucursalId,
      pacienteId: body.pacienteId,
      profesionalId: req.user.sub,
      eventType: 'message_sent',
      req,
      details: { messageId: id, direction: 'professional_to_patient' },
      auditEntityType: 'patient_portal_message',
      auditEntityId: id,
      auditOperation: 'create',
    });

    res.status(201).json({ message: created.recordset[0] ? rowToPortalMessage(created.recordset[0]) : { id } });
  } catch (err) {
    next(err);
  }
});

router.patch('/messages/:id/read', requireAuth, requireSucursalAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    if (!isUuid(id)) {
      res.status(400).json({ error: 'id debe ser UUID' });
      return;
    }

    const sucursalId = String(req.sucursalId);
    const pool = await getPool();

    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query(
        `UPDATE patient_portal_messages
            SET read_at = COALESCE(read_at, SYSUTCDATETIME())
          WHERE id = @id
            AND sucursal_id = @sucursal_id`,
      );

    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<PortalMessageRow>(
        `SELECT id, token_id, paciente_id, sucursal_id, profesional_id, content, direction, read_at, created_at
           FROM patient_portal_messages
          WHERE id = @id
            AND sucursal_id = @sucursal_id`,
      );
    const row = result.recordset[0];
    if (!row) {
      res.status(404).json({ error: 'Mensaje no encontrado' });
      return;
    }

    res.json({ message: rowToPortalMessage(row) });
  } catch (err) {
    next(err);
  }
});

// ─── Protected: Professional meal-photo review ─────────────────

router.get('/meal-photos', requireAuth, requireSucursalAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pacienteId = typeof req.query.pacienteId === 'string' ? req.query.pacienteId : '';
    if (!isUuid(pacienteId)) {
      res.status(400).json({ error: 'pacienteId debe ser UUID' });
      return;
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input('sucursal_id', sql.UniqueIdentifier(), String(req.sucursalId))
      .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
      .query<PortalMealPhotoRow>(
        `SELECT TOP 50 id, token_id, paciente_id, sucursal_id, meal_date, meal_slot, caption,
                adherence_rating, mime_type, file_name, size_bytes, sha256,
                reviewed_at, reviewed_by_profesional_id, created_at, updated_at
           FROM patient_portal_meal_photos
          WHERE sucursal_id = @sucursal_id
            AND paciente_id = @paciente_id
            AND deleted_at IS NULL
          ORDER BY meal_date DESC, created_at DESC`,
      );

    res.json({ mealPhotos: result.recordset.map(rowToPortalMealPhoto) });
  } catch (err) {
    next(err);
  }
});

router.get('/meal-photos/:id/image', requireAuth, requireSucursalAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    if (!isUuid(id)) {
      res.status(400).json({ error: 'id debe ser UUID' });
      return;
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), String(req.sucursalId))
      .query<PortalMealPhotoRow>(
        `SELECT id, token_id, paciente_id, sucursal_id, meal_date, meal_slot, caption,
                adherence_rating, mime_type, file_name, size_bytes, sha256, photo_bytes,
                reviewed_at, reviewed_by_profesional_id, created_at, updated_at
           FROM patient_portal_meal_photos
          WHERE id = @id
            AND sucursal_id = @sucursal_id
            AND deleted_at IS NULL`,
      );
    const row = result.recordset[0];
    if (!row?.photo_bytes) {
      res.status(404).json({ error: 'Foto no encontrada' });
      return;
    }

    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${row.file_name}"`);
    res.setHeader('Content-Length', row.photo_bytes.length);
    res.setHeader('X-Document-SHA256', row.sha256);
    res.end(row.photo_bytes);
  } catch (err) {
    next(err);
  }
});

router.patch('/meal-photos/:id/review', requireAuth, requireSucursalAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !canManagePortalTokens(req.user.rol)) {
      throw new ForbiddenError('Rol sin permisos para revisar fotos');
    }
    const id = String(req.params.id);
    if (!isUuid(id)) {
      res.status(400).json({ error: 'id debe ser UUID' });
      return;
    }

    const sucursalId = String(req.sucursalId);
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .input('profesional_id', sql.UniqueIdentifier(), req.user.sub)
      .query(
        `UPDATE patient_portal_meal_photos
            SET reviewed_at = COALESCE(reviewed_at, SYSUTCDATETIME()),
                reviewed_by_profesional_id = COALESCE(reviewed_by_profesional_id, @profesional_id),
                updated_at = SYSUTCDATETIME()
          WHERE id = @id
            AND sucursal_id = @sucursal_id
            AND deleted_at IS NULL`,
      );

    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<PortalMealPhotoRow>(
        `SELECT id, token_id, paciente_id, sucursal_id, meal_date, meal_slot, caption,
                adherence_rating, mime_type, file_name, size_bytes, sha256,
                reviewed_at, reviewed_by_profesional_id, created_at, updated_at
           FROM patient_portal_meal_photos
          WHERE id = @id
            AND sucursal_id = @sucursal_id
            AND deleted_at IS NULL`,
      );
    const row = result.recordset[0];
    if (!row) {
      res.status(404).json({ error: 'Foto no encontrada' });
      return;
    }

    await recordPortalAudit(pool, {
      tokenId: row.token_id,
      sucursalId,
      pacienteId: row.paciente_id,
      profesionalId: req.user.sub,
      eventType: 'meal_photo_reviewed',
      req,
      details: { mealPhotoId: id },
      auditEntityType: 'patient_portal_meal_photo',
      auditEntityId: id,
      auditOperation: 'update',
    });

    res.json({ mealPhoto: rowToPortalMealPhoto(row) });
  } catch (err) {
    next(err);
  }
});

router.patch('/tokens/:id/revoke', requireAuth, requireSucursalAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !canManagePortalTokens(req.user.rol)) {
      throw new ForbiddenError('Rol sin permisos para gestionar enlaces del portal');
    }
    const id = String(req.params.id);
    if (!isUuid(id)) {
      res.status(400).json({ error: 'id debe ser UUID' });
      return;
    }

    const sucursalId = String(req.sucursalId);
    const pool = await getPool();
    const existing = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<PortalTokenRow>(
        `SELECT id, sucursal_id, paciente_id, label, scopes_json, expires_at, revoked_at,
                last_accessed_at, created_by_profesional_id, created_at, updated_at
           FROM patient_portal_tokens
          WHERE id = @id
            AND sucursal_id = @sucursal_id`,
      );
    const existingRow = existing.recordset[0];
    if (!existingRow) {
      res.status(404).json({ error: 'Enlace del portal no encontrado' });
      return;
    }

    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query(
        `UPDATE patient_portal_tokens
            SET revoked_at = COALESCE(revoked_at, SYSUTCDATETIME()),
                updated_at = SYSUTCDATETIME()
          WHERE id = @id
            AND sucursal_id = @sucursal_id`,
      );

    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<PortalTokenRow>(
        `SELECT id, sucursal_id, paciente_id, label, scopes_json, expires_at, revoked_at,
                last_accessed_at, created_by_profesional_id, created_at, updated_at
           FROM patient_portal_tokens
          WHERE id = @id
            AND sucursal_id = @sucursal_id`,
      );
    const row = result.recordset[0];
    if (!row) {
      res.status(404).json({ error: 'Enlace del portal no encontrado' });
      return;
    }

    await recordPortalAudit(pool, {
      tokenId: row.id,
      sucursalId: row.sucursal_id,
      pacienteId: row.paciente_id,
      profesionalId: req.user.sub,
      eventType: 'revoked',
      req,
      details: { label: row.label, previousStatus: portalTokenStatus(existingRow) },
    });

    res.json({ token: rowToPortalToken(row) });
  } catch (err) {
    next(err);
  }
});

router.post('/:token/adherence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = PortalTokenParam.safeParse(req.params.token);
    if (!token.success) {
      notFound(res);
      return;
    }

    const body = PortalAdherenceBody.parse(req.body);
    const recordDate = body.date ?? todayDateOnly();
    const pool = await getPool();
    const access = await loadPortalAccess(pool, token.data);
    if (!access) {
      notFound(res);
      return;
    }

    const scopes = new Set(parsePortalScopes(access.scopes_json));
    if (!scopes.has('adherence')) {
      throw new ForbiddenError('Este enlace no permite registrar adherencia');
    }

    const id = randomUUID();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), access.sucursal_id)
      .input('paciente_id', sql.UniqueIdentifier(), access.paciente_id)
      .input('source', sql.NVarChar(20), 'portal')
      .input('record_date', sql.Date(), dateFromDateOnly(recordDate))
      .input('adherence_menu', sql.Decimal(5, 2), body.adherenceMenu)
      .input('adherence_water', sql.Decimal(5, 2), body.adherenceWater)
      .input('adherence_activity', sql.Decimal(5, 2), body.adherenceActivity)
      .input('adherence_supplements', sql.Decimal(5, 2), body.adherenceSupplements)
      .input('adherence_sleep', sql.Decimal(5, 2), body.adherenceSleep)
      .input('hunger_avg', sql.Decimal(4, 1), body.hungerAvg ?? null)
      .input('satiety_avg', sql.Decimal(4, 1), body.satietyAvg ?? null)
      .input('mood_avg', sql.Decimal(4, 1), body.moodAvg ?? null)
      .input('energy_avg', sql.Decimal(4, 1), body.energyAvg ?? null)
      .input('intercurrent_events', sql.NVarChar(1000), body.intercurrentEvents)
      .input('barriers', sql.NVarChar(1000), body.barriers)
      .input('facilitators', sql.NVarChar(1000), body.facilitators)
      .input('meals_logged', sql.NVarChar(2000), body.mealsLogged)
      .input('notes', sql.NVarChar(2000), body.notes)
      .input('submitted_by_token_id', sql.UniqueIdentifier(), access.token_id)
      .query(
        `INSERT INTO adherence_records
           (id, sucursal_id, paciente_id, source, record_date, adherence_menu, adherence_water,
            adherence_activity, adherence_supplements, adherence_sleep, hunger_avg, satiety_avg,
            mood_avg, energy_avg, intercurrent_events, barriers, facilitators, meals_logged,
            notes, submitted_by_token_id)
         VALUES
           (@id, @sucursal_id, @paciente_id, @source, @record_date, @adherence_menu, @adherence_water,
            @adherence_activity, @adherence_supplements, @adherence_sleep, @hunger_avg, @satiety_avg,
            @mood_avg, @energy_avg, @intercurrent_events, @barriers, @facilitators, @meals_logged,
            @notes, @submitted_by_token_id)`,
      );

    await touchPortalToken(pool, access.token_id);

    const created = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .query<PortalAdherenceRecordRow>(
        `SELECT id, sucursal_id, paciente_id, consulta_id, source, record_date,
                adherence_menu, adherence_water, adherence_activity, adherence_supplements,
                adherence_sleep, hunger_avg, satiety_avg, mood_avg, energy_avg,
                intercurrent_events, barriers, facilitators, meals_logged, notes,
                submitted_by_token_id, created_at, updated_at
           FROM adherence_records
          WHERE id = @id`,
      );
    const row = created.recordset[0];

    await recordPortalAudit(pool, {
      tokenId: access.token_id,
      sucursalId: access.sucursal_id,
      pacienteId: access.paciente_id,
      eventType: 'adherence_submitted',
      req,
      details: {
        adherenceRecordId: id,
        recordDate,
        scores: {
          menu: body.adherenceMenu,
          water: body.adherenceWater,
          activity: body.adherenceActivity,
          supplements: body.adherenceSupplements,
          sleep: body.adherenceSleep,
        },
      },
      auditEntityType: 'adherence_record',
      auditEntityId: id,
      auditOperation: 'create',
    });

    if (access.email) {
      const html = renderTemplate('adherence_confirmation', {
        patientName: fullName(access),
        recordDate,
        adherenceMenu: String(body.adherenceMenu),
        adherenceWater: String(body.adherenceWater),
        adherenceActivity: String(body.adherenceActivity),
        adherenceSupplements: String(body.adherenceSupplements),
        adherenceSleep: String(body.adherenceSleep),
      });
      const subject = 'Registro de adherencia recibido - NutriClínica';
      const emailResult = await sendEmail({ to: access.email, subject, html });
      await logEmailSent({
        pacienteId: access.paciente_id,
        tipo: 'adherence_confirmation',
        destinatario: access.email,
        asunto: subject,
        contenidoHtml: html,
        messageId: emailResult.messageId,
        error: emailResult.success ? null : (emailResult.error ?? null),
      });
    }

    res.status(201).json({ record: row ? rowToPortalAdherenceRecord(row) : { id } });
  } catch (err) {
    next(err);
  }
});

router.get('/:token/meal-photos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = PortalTokenParam.safeParse(req.params.token);
    if (!token.success) { notFound(res); return; }

    const pool = await getPool();
    const access = await loadPortalAccess(pool, token.data);
    if (!access) { notFound(res); return; }

    const scopes = new Set(parsePortalScopes(access.scopes_json));
    if (!scopes.has('meal_photos')) {
      throw new ForbiddenError('Este enlace no permite registrar comidas');
    }

    await touchPortalToken(pool, access.token_id);

    const result = await pool
      .request()
      .input('paciente_id', sql.UniqueIdentifier(), access.paciente_id)
      .input('sucursal_id', sql.UniqueIdentifier(), access.sucursal_id)
      .query<PortalMealPhotoRow>(
        `SELECT TOP 30 id, token_id, paciente_id, sucursal_id, meal_date, meal_slot, caption,
                adherence_rating, mime_type, file_name, size_bytes, sha256,
                reviewed_at, reviewed_by_profesional_id, created_at, updated_at
           FROM patient_portal_meal_photos
          WHERE paciente_id = @paciente_id
            AND sucursal_id = @sucursal_id
            AND deleted_at IS NULL
          ORDER BY meal_date DESC, created_at DESC`,
      );

    res.json({ mealPhotos: result.recordset.map(rowToPortalMealPhoto) });
  } catch (err) {
    next(err);
  }
});

router.post('/:token/meal-photos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = PortalTokenParam.safeParse(req.params.token);
    if (!token.success) { notFound(res); return; }

    const body = PortalMealPhotoBody.parse(req.body);
    const parsedPhoto = parseMealPhotoDataUrl(body.photoDataUrl);
    if (!parsedPhoto) {
      res.status(400).json({ error: 'La foto debe ser JPEG, PNG o WebP y pesar máximo 2 MB' });
      return;
    }

    const pool = await getPool();
    const access = await loadPortalAccess(pool, token.data);
    if (!access) { notFound(res); return; }

    const scopes = new Set(parsePortalScopes(access.scopes_json));
    if (!scopes.has('meal_photos')) {
      throw new ForbiddenError('Este enlace no permite registrar comidas');
    }

    await touchPortalToken(pool, access.token_id);

    const id = randomUUID();
    const mealDate = body.mealDate ?? todayDateOnly();
    const fileName = sanitizeMealPhotoFileName(body.fileName, parsedPhoto.mimeType);
    const sha256 = createHash('sha256').update(parsedPhoto.buffer).digest('hex');

    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('token_id', sql.UniqueIdentifier(), access.token_id)
      .input('paciente_id', sql.UniqueIdentifier(), access.paciente_id)
      .input('sucursal_id', sql.UniqueIdentifier(), access.sucursal_id)
      .input('meal_date', sql.Date(), dateFromDateOnly(mealDate))
      .input('meal_slot', sql.NVarChar(50), body.mealSlot)
      .input('caption', sql.NVarChar(1000), body.caption)
      .input('adherence_rating', sql.TinyInt(), body.adherenceRating)
      .input('mime_type', sql.NVarChar(80), parsedPhoto.mimeType)
      .input('file_name', sql.NVarChar(180), fileName)
      .input('size_bytes', sql.Int(), parsedPhoto.buffer.length)
      .input('sha256', sql.NVarChar(64), sha256)
      .input('photo_bytes', sql.VarBinary(sql.MAX), parsedPhoto.buffer)
      .query(
        `INSERT INTO patient_portal_meal_photos
           (id, token_id, paciente_id, sucursal_id, meal_date, meal_slot, caption,
            adherence_rating, mime_type, file_name, size_bytes, sha256, photo_bytes)
         VALUES
           (@id, @token_id, @paciente_id, @sucursal_id, @meal_date, @meal_slot, @caption,
            @adherence_rating, @mime_type, @file_name, @size_bytes, @sha256, @photo_bytes)`,
      );

    const created = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .query<PortalMealPhotoRow>(
        `SELECT id, token_id, paciente_id, sucursal_id, meal_date, meal_slot, caption,
                adherence_rating, mime_type, file_name, size_bytes, sha256,
                reviewed_at, reviewed_by_profesional_id, created_at, updated_at
           FROM patient_portal_meal_photos
          WHERE id = @id`,
      );
    const row = created.recordset[0];

    await recordPortalAudit(pool, {
      tokenId: access.token_id,
      sucursalId: access.sucursal_id,
      pacienteId: access.paciente_id,
      eventType: 'meal_photo_submitted',
      req,
      details: {
        mealPhotoId: id,
        mealDate,
        mealSlot: body.mealSlot,
        adherenceRating: body.adherenceRating,
        sizeBytes: parsedPhoto.buffer.length,
        sha256,
      },
      auditEntityType: 'patient_portal_meal_photo',
      auditEntityId: id,
      auditOperation: 'create',
    });

    res.status(201).json({ mealPhoto: row ? rowToPortalMealPhoto(row) : { id } });
  } catch (err) {
    next(err);
  }
});

router.get('/:token/meal-photos/:id/image', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = PortalTokenParam.safeParse(req.params.token);
    if (!token.success) { notFound(res); return; }
    const id = String(req.params.id);
    if (!isUuid(id)) {
      res.status(400).json({ error: 'id debe ser UUID' });
      return;
    }

    const pool = await getPool();
    const access = await loadPortalAccess(pool, token.data);
    if (!access) { notFound(res); return; }

    const scopes = new Set(parsePortalScopes(access.scopes_json));
    if (!scopes.has('meal_photos')) {
      throw new ForbiddenError('Este enlace no permite ver fotos de comidas');
    }

    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('paciente_id', sql.UniqueIdentifier(), access.paciente_id)
      .input('sucursal_id', sql.UniqueIdentifier(), access.sucursal_id)
      .query<PortalMealPhotoRow>(
        `SELECT id, token_id, paciente_id, sucursal_id, meal_date, meal_slot, caption,
                adherence_rating, mime_type, file_name, size_bytes, sha256, photo_bytes,
                reviewed_at, reviewed_by_profesional_id, created_at, updated_at
           FROM patient_portal_meal_photos
          WHERE id = @id
            AND paciente_id = @paciente_id
            AND sucursal_id = @sucursal_id
            AND deleted_at IS NULL`,
      );
    const row = result.recordset[0];
    if (!row?.photo_bytes) {
      res.status(404).json({ error: 'Foto no encontrada' });
      return;
    }

    await touchPortalToken(pool, access.token_id);
    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${row.file_name}"`);
    res.setHeader('Content-Length', row.photo_bytes.length);
    res.setHeader('X-Document-SHA256', row.sha256);
    res.end(row.photo_bytes);
  } catch (err) {
    next(err);
  }
});

router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = PortalTokenParam.safeParse(req.params.token);
    if (!token.success) {
      notFound(res);
      return;
    }

    const pool = await getPool();
    const access = await loadPortalAccess(pool, token.data);
    if (!access) {
      notFound(res);
      return;
    }

    await touchPortalToken(pool, access.token_id);

    const scopes = new Set(parsePortalScopes(access.scopes_json));
    const pacienteId = access.paciente_id;
    const sucursalId = access.sucursal_id;

    const activePlan = scopes.has('plan')
      ? await loadActivePlan(pool, pacienteId, sucursalId)
      : null;
    const upcomingAppointments = scopes.has('appointments')
      ? await loadUpcomingAppointments(pool, pacienteId, sucursalId)
      : [];
    const documents = scopes.has('documents')
      ? await loadDocuments(pool, pacienteId)
      : [];

    await recordPortalAudit(pool, {
      tokenId: access.token_id,
      sucursalId,
      pacienteId,
      eventType: 'accessed',
      req,
      details: { scopes: Array.from(scopes) },
    });

    res.json({
      portal: {
        tokenId: access.token_id,
        sucursalId,
        expiresAt: iso(access.expires_at),
        scopes: Array.from(scopes),
      },
      patient: {
        id: pacienteId,
        fullName: fullName(access),
        birthDate: dateOnly(access.fecha_nacimiento),
        sex: access.sexo,
        email: access.email,
        phone: access.telefono,
        updatedAt: iso(access.updated_at),
      },
      summary: scopes.has('summary')
        ? {
            activePlanName: activePlan?.name ?? null,
            nextAppointmentAt: upcomingAppointments[0]?.consultationDate ?? null,
            documentsCount: documents.length,
          }
        : null,
      activePlan,
      upcomingAppointments,
      documents,
    });
  } catch (err) {
    next(err);
  }
});

async function loadActivePlan(pool: sql.ConnectionPool, pacienteId: string, sucursalId: string) {
  const result = await pool
    .request()
    .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
    .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
    .query<PortalPlanRow>(
      `SELECT TOP 1 id, name, description, start_date, end_date, kcal_target, protein_target_g,
              carbs_target_g, fat_target_g, meals_json, notes, status, updated_at
         FROM planes_alimenticios
        WHERE paciente_id = @paciente_id
          AND sucursal_id = @sucursal_id
          AND status = 'active'
          AND deleted_at IS NULL
        ORDER BY start_date DESC, created_at DESC`,
    );
  const row = result.recordset[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    startDate: dateOnly(row.start_date),
    endDate: dateOnly(row.end_date),
    kcalTarget: row.kcal_target,
    proteinTargetG: row.protein_target_g,
    carbsTargetG: row.carbs_target_g,
    fatTargetG: row.fat_target_g,
    meals: parsePortalMeals(row.meals_json),
    notes: row.notes,
    status: row.status,
    updatedAt: iso(row.updated_at),
  };
}

async function loadUpcomingAppointments(pool: sql.ConnectionPool, pacienteId: string, sucursalId: string) {
  const result = await pool
    .request()
    .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
    .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
    .query<PortalConsultationRow>(
      `SELECT TOP 5 id, consultation_date, status, reason, next_visit_date
         FROM consultas
        WHERE paciente_id = @paciente_id
          AND sucursal_id = @sucursal_id
          AND deleted_at IS NULL
          AND status IN ('scheduled', 'in-progress')
          AND consultation_date >= DATEADD(day, -1, SYSUTCDATETIME())
        ORDER BY consultation_date ASC`,
    );
  return result.recordset.map((row) => ({
    id: row.id,
    consultationDate: iso(row.consultation_date),
    status: row.status,
    reason: row.reason,
    nextVisitDate: dateOnly(row.next_visit_date),
  }));
}

async function loadDocuments(pool: sql.ConnectionPool, pacienteId: string) {
  const result = await pool
    .request()
    .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
    .query<PortalDocumentRow>(
      `SELECT TOP 10 id, tipo, nombre_archivo, mime_type, tamano_bytes, url_storage,
              hash_sha256, fecha_documento, notas, created_at
         FROM documentos
        WHERE paciente_id = @paciente_id
          AND deleted_at IS NULL
        ORDER BY ISNULL(fecha_documento, CAST(created_at AS date)) DESC, created_at DESC`,
    );
  return result.recordset.map((row) => ({
    id: row.id,
    type: row.tipo,
    fileName: row.nombre_archivo,
    mimeType: row.mime_type,
    sizeBytes: row.tamano_bytes,
    url: row.url_storage,
    sha256: row.hash_sha256,
    documentDate: dateOnly(row.fecha_documento),
    notes: row.notas,
    createdAt: iso(row.created_at),
  }));
}

router.post('/:token/send-reminder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = PortalTokenParam.safeParse(req.params.token);
    if (!token.success) { notFound(res); return; }

    const pool = await getPool();
    const access = await loadPortalAccess(pool, token.data);
    if (!access) { notFound(res); return; }

    if (!access.email) {
      res.status(400).json({ error: 'El paciente no tiene correo registrado' });
      return;
    }

    const scopes = new Set(parsePortalScopes(access.scopes_json));
    if (!scopes.has('appointments')) {
      throw new ForbiddenError('Este enlace no permite consultar citas');
    }

    await touchPortalToken(pool, access.token_id);

    const appointment = await loadUpcomingAppointments(pool, access.paciente_id, access.sucursal_id);
    const nextAppt = appointment[0];

    const patientName = fullName(access);
    const variables: Record<string, string> = {
      patientName,
      appointmentDate: nextAppt ? new Date(nextAppt.consultationDate ?? '').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No programada',
      appointmentReason: nextAppt?.reason ?? 'Consulta de seguimiento',
    };

    const html = renderTemplate('appointment_reminder', variables);
    const subject = 'Recordatorio de cita - NutriClínica';
    const result = await sendEmail({ to: access.email, subject, html, text: `Hola ${patientName}, tienes una cita el ${variables.appointmentDate}. Motivo: ${variables.appointmentReason}` });

    await logEmailSent({
      pacienteId: access.paciente_id,
      tipo: 'appointment_reminder',
      destinatario: access.email,
      asunto: subject,
      contenidoHtml: html,
      messageId: result.messageId,
      error: result.success ? null : (result.error ?? 'Error desconocido'),
    });

    res.json({
      sent: result.success,
      messageId: result.messageId,
      to: access.email,
      appointmentDate: variables.appointmentDate,
    });
  } catch (err) { next(err); }
});

router.get('/:token/notifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = PortalTokenParam.safeParse(req.params.token);
    if (!token.success) { notFound(res); return; }

    const pool = await getPool();
    const access = await loadPortalAccess(pool, token.data);
    if (!access) { notFound(res); return; }

    const result = await pool
      .request()
      .input('paciente_id', sql.UniqueIdentifier(), access.paciente_id)
      .query(
        `SELECT TOP 20 id, tipo, destinatario, asunto, error, enviado_en
           FROM notificaciones_email
          WHERE paciente_id = @paciente_id
          ORDER BY enviado_en DESC`,
      );

    res.json({
      notifications: result.recordset.map((row: Record<string, unknown>) => ({
        id: row.id,
        type: row.tipo,
        to: row.destinatario,
        subject: row.asunto,
        error: row.error || null,
        sentAt: row.enviado_en instanceof Date ? row.enviado_en.toISOString() : String(row.enviado_en),
      })),
    });
  } catch (err) { next(err); }
});

router.get('/:token/documents/:documentId/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = PortalTokenParam.safeParse(req.params.token);
    if (!token.success) {
      notFound(res);
      return;
    }
    const documentId = String(req.params.documentId);
    if (!isUuid(documentId)) {
      res.status(400).json({ error: 'documentId debe ser UUID' });
      return;
    }

    const pool = await getPool();
    const access = await loadPortalAccess(pool, token.data);
    if (!access) {
      notFound(res);
      return;
    }

    const scopes = new Set(parsePortalScopes(access.scopes_json));
    if (!scopes.has('documents')) {
      throw new ForbiddenError('Este enlace no permite descargar documentos');
    }

    const docResult = await pool
      .request()
      .input('document_id', sql.UniqueIdentifier(), documentId)
      .input('paciente_id', sql.UniqueIdentifier(), access.paciente_id)
      .query<PortalDocumentRow>(
        `SELECT id, tipo, nombre_archivo, mime_type, tamano_bytes, url_storage,
                hash_sha256, fecha_documento, notas, created_at
           FROM documentos
          WHERE id = @document_id
            AND paciente_id = @paciente_id
            AND deleted_at IS NULL`,
      );
    const doc = docResult.recordset[0];
    if (!doc) {
      res.status(404).json({ error: 'Documento no encontrado' });
      return;
    }

    await touchPortalToken(pool, access.token_id);

    const isPreview = req.query.preview === '1';

    try {
      const fileResponse = await fetch(doc.url_storage, { signal: AbortSignal.timeout(30_000) });
      if (!fileResponse.ok) {
        res.status(502).json({ error: 'No se pudo recuperar el archivo del almacenamiento' });
        return;
      }

      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
      const computedHash = createHash('sha256').update(fileBuffer).digest('hex');
      const hashMatch = computedHash === doc.hash_sha256;

      res.setHeader('Content-Type', doc.mime_type);
      res.setHeader('Content-Disposition', isPreview ? 'inline' : `attachment; filename="${doc.nombre_archivo}"`);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('X-Document-SHA256', doc.hash_sha256);
      res.setHeader('X-Document-SHA256-Verified', hashMatch ? 'true' : 'false');

      await recordPortalAudit(pool, {
        tokenId: access.token_id,
        sucursalId: access.sucursal_id,
        pacienteId: access.paciente_id,
        eventType: 'document_downloaded',
        req,
        details: {
          documentId: doc.id,
          fileName: doc.nombre_archivo,
          fileSize: doc.tamano_bytes,
          sha256: doc.hash_sha256,
          hashMatch,
          preview: isPreview,
        },
        auditEntityType: 'documento',
        auditEntityId: doc.id,
        auditOperation: 'read',
      });

      res.end(fileBuffer);
    } catch (fetchErr) {
      res.status(502).json({ error: 'No se pudo recuperar el archivo del almacenamiento externo' });
    }
  } catch (err) {
    next(err);
  }
});

// ─── Public: Patient messaging via portal token ────────────────

router.get('/:token/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = PortalTokenParam.safeParse(req.params.token);
    if (!token.success) { notFound(res); return; }

    const pool = await getPool();
    const access = await loadPortalAccess(pool, token.data);
    if (!access) { notFound(res); return; }

    const scopes = new Set(parsePortalScopes(access.scopes_json));
    if (!scopes.has('messaging')) {
      throw new ForbiddenError('Este enlace no permite mensajería');
    }

    await touchPortalToken(pool, access.token_id);

    const result = await pool
      .request()
      .input('paciente_id', sql.UniqueIdentifier(), access.paciente_id)
      .input('sucursal_id', sql.UniqueIdentifier(), access.sucursal_id)
      .query<PortalMessageRow>(
        `SELECT id, token_id, paciente_id, sucursal_id, profesional_id, content, direction, read_at, created_at
           FROM patient_portal_messages
          WHERE paciente_id = @paciente_id
            AND sucursal_id = @sucursal_id
          ORDER BY created_at ASC`,
      );

    res.json({ messages: result.recordset.map(rowToPortalMessage) });
  } catch (err) {
    next(err);
  }
});

router.post('/:token/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = PortalTokenParam.safeParse(req.params.token);
    if (!token.success) { notFound(res); return; }

    const MessageSendBody = z.object({
      content: z.string().trim().min(1).max(2000),
    });
    const body = MessageSendBody.parse(req.body);

    const pool = await getPool();
    const access = await loadPortalAccess(pool, token.data);
    if (!access) { notFound(res); return; }

    const scopes = new Set(parsePortalScopes(access.scopes_json));
    if (!scopes.has('messaging')) {
      throw new ForbiddenError('Este enlace no permite mensajería');
    }

    await touchPortalToken(pool, access.token_id);

    const id = randomUUID();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('token_id', sql.UniqueIdentifier(), access.token_id)
      .input('paciente_id', sql.UniqueIdentifier(), access.paciente_id)
      .input('sucursal_id', sql.UniqueIdentifier(), access.sucursal_id)
      .input('content', sql.NVarChar(2000), body.content)
      .input('direction', sql.NVarChar(30), 'patient_to_professional')
      .query(
        `INSERT INTO patient_portal_messages
           (id, token_id, paciente_id, sucursal_id, content, direction)
         VALUES
           (@id, @token_id, @paciente_id, @sucursal_id, @content, @direction)`,
      );

    const created = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .query<PortalMessageRow>(
        `SELECT id, token_id, paciente_id, sucursal_id, profesional_id, content, direction, read_at, created_at
           FROM patient_portal_messages
          WHERE id = @id`,
      );

    await recordPortalAudit(pool, {
      tokenId: access.token_id,
      sucursalId: access.sucursal_id,
      pacienteId: access.paciente_id,
      eventType: 'message_sent',
      req,
      details: { messageId: id, direction: 'patient_to_professional' },
      auditEntityType: 'patient_portal_message',
      auditEntityId: id,
      auditOperation: 'create',
    });

    // Notify professional by email
    try {
      const profResult = await pool
        .request()
        .input('sucursal_id', sql.UniqueIdentifier(), access.sucursal_id)
        .query<{ id: string; email: string | null; nombre: string }>(
          `SELECT TOP 1 id, email, CONCAT(nombres, ' ', apellido_paterno) AS nombre
             FROM profesionales
            WHERE sucursal_id = @sucursal_id
              AND activo = 1
            ORDER BY created_at ASC`,
        );
      const prof = profResult.recordset[0];
      if (prof?.email) {
        const html = `<p>El paciente <strong>${fullName(access)}</strong> ha enviado un mensaje desde el portal.</p>
                      <blockquote style="padding:12px;margin:12px 0;border-left:4px solid #3b82f6;background:#f8fafc;">
                        ${body.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                      </blockquote>
                      <p><a href="${req.protocol}://${req.get('host')}/#/pacientes/${access.paciente_id}" style="color:#3b82f6;">Ver en NutriClínica</a></p>`;
        const subject = `Nuevo mensaje de ${fullName(access)} - NutriClínica`;
        const emailResult = await sendEmail({ to: prof.email, subject, html });
        await logEmailSent({
          pacienteId: access.paciente_id,
          tipo: 'patient_message',
          destinatario: prof.email,
          asunto: subject,
          contenidoHtml: html,
          messageId: emailResult.messageId,
          error: emailResult.success ? null : (emailResult.error ?? 'Error desconocido'),
        });
      }
    } catch {
      // Email notification failure should not block the message
    }

    res.status(201).json({ message: created.recordset[0] ? rowToPortalMessage(created.recordset[0]) : { id } });
  } catch (err) {
    next(err);
  }
});

export default router;
