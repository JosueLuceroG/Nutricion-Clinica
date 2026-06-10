import { z } from "zod";
import { NetworkError, httpRequest } from "./httpClient.js";

const PORTAL_CACHE_VERSION = 1;
const PORTAL_PAYLOAD_CACHE_PREFIX = "nutriclinica:patient-portal:payload:";
const PORTAL_NOTIFICATIONS_CACHE_PREFIX =
  "nutriclinica:patient-portal:notifications:";
const PORTAL_ADHERENCE_QUEUE_PREFIX =
  "nutriclinica:patient-portal:adherence-queue:";
const portalAdherenceFlushes = new Map<
  string,
  Promise<PortalAdherenceFlushResult>
>();

const PortalMealExchangeSchema = z.object({
  foodId: z.string(),
  count: z.number(),
});

const PortalMealSchema = z.object({
  slot: z.string(),
  exchanges: z.array(PortalMealExchangeSchema),
});

const PatientPortalPayloadSchema = z.object({
  portal: z.object({
    tokenId: z.string(),
    sucursalId: z.string(),
    expiresAt: z.string().nullable(),
    scopes: z.array(z.string()),
  }),
  patient: z.object({
    id: z.string(),
    fullName: z.string(),
    birthDate: z.string().nullable(),
    sex: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }),
  summary: z
    .object({
      activePlanName: z.string().nullable(),
      nextAppointmentAt: z.string().nullable(),
      documentsCount: z.number(),
    })
    .nullable(),
  activePlan: z
    .object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      kcalTarget: z.number(),
      proteinTargetG: z.number(),
      carbsTargetG: z.number(),
      fatTargetG: z.number(),
      meals: z.array(PortalMealSchema),
      notes: z.string().nullable(),
      status: z.string(),
      updatedAt: z.string().nullable(),
    })
    .nullable(),
  upcomingAppointments: z.array(
    z.object({
      id: z.string(),
      consultationDate: z.string().nullable(),
      status: z.string(),
      reason: z.string(),
      nextVisitDate: z.string().nullable(),
    }),
  ),
  documents: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
      sizeBytes: z.number(),
      url: z.string(),
      sha256: z.string(),
      documentDate: z.string().nullable(),
      notes: z.string().nullable(),
      createdAt: z.string().nullable(),
    }),
  ),
});

const PatientPortalPayloadCacheSchema = z.object({
  version: z.literal(PORTAL_CACHE_VERSION),
  cachedAt: z.string(),
  data: PatientPortalPayloadSchema,
});

const PortalAuditEventSchema = z.object({
  id: z.string(),
  tokenId: z.string(),
  sucursalId: z.string(),
  pacienteId: z.string(),
  profesionalId: z.string().nullable(),
  type: z.enum(["created", "revoked", "accessed", "adherence_submitted"]),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  details: z.record(z.unknown()).nullable(),
  occurredAt: z.string().nullable(),
});

const PortalLinkSchema = z.object({
  id: z.string(),
  sucursalId: z.string(),
  pacienteId: z.string(),
  label: z.string().nullable(),
  scopes: z.array(z.string()),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  lastAccessedAt: z.string().nullable(),
  createdByProfesionalId: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  status: z.enum(["active", "expired", "revoked"]),
  recentEvents: z.array(PortalAuditEventSchema).default([]),
});

const PortalLinksResponseSchema = z.object({
  tokens: z.array(PortalLinkSchema),
});

const PortalAdherenceRecordSchema = z.object({
  id: z.string(),
  sucursalId: z.string().optional(),
  pacienteId: z.string().optional(),
  consultationId: z.string().nullable().optional(),
  source: z.string().optional(),
  date: z.string().nullable().optional(),
  adherenceMenu: z.number().optional(),
  adherenceWater: z.number().optional(),
  adherenceActivity: z.number().optional(),
  adherenceSupplements: z.number().optional(),
  adherenceSleep: z.number().optional(),
  hungerAvg: z.number().nullable().optional(),
  satietyAvg: z.number().nullable().optional(),
  moodAvg: z.number().nullable().optional(),
  energyAvg: z.number().nullable().optional(),
  intercurrentEvents: z.string().optional(),
  barriers: z.string().optional(),
  facilitators: z.string().optional(),
  mealsLogged: z.string().optional(),
  notes: z.string().optional(),
  submittedByTokenId: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

const SubmitPortalAdherenceResponseSchema = z.object({
  record: PortalAdherenceRecordSchema,
});

const PortalNotificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  to: z.string(),
  subject: z.string(),
  error: z.string().nullable(),
  sentAt: z.string(),
});

const PortalNotificationsCacheSchema = z.object({
  version: z.literal(PORTAL_CACHE_VERSION),
  cachedAt: z.string(),
  notifications: z.array(PortalNotificationSchema),
});

const CreatePortalLinkResponseSchema = z.object({
  token: z.string(),
  portalPath: z.string(),
  link: PortalLinkSchema,
});

const RevokePortalLinkResponseSchema = z.object({
  token: PortalLinkSchema,
});

export type PatientPortalPayload = z.infer<typeof PatientPortalPayloadSchema>;
export type PatientPortalPlan = NonNullable<PatientPortalPayload["activePlan"]>;
export type PatientPortalMeal = PatientPortalPlan["meals"][number];
export type PortalLink = z.infer<typeof PortalLinkSchema>;
export type PortalAuditEvent = z.infer<typeof PortalAuditEventSchema>;
export type PortalAdherenceRecord = z.infer<typeof PortalAdherenceRecordSchema>;
export type PortalNotification = z.infer<typeof PortalNotificationSchema>;
export type PortalCacheSource = "network" | "cache";
export type CreatePortalLinkResponse = z.infer<
  typeof CreatePortalLinkResponseSchema
>;

export interface CreatePortalLinkInput {
  pacienteId: string;
  label?: string | null;
  expiresInDays?: number;
  scopes?: string[];
}

export interface SubmitPortalAdherenceInput {
  date?: string;
  adherenceMenu: number;
  adherenceWater: number;
  adherenceActivity: number;
  adherenceSupplements: number;
  adherenceSleep: number;
  hungerAvg?: number | null;
  satietyAvg?: number | null;
  moodAvg?: number | null;
  energyAvg?: number | null;
  intercurrentEvents?: string;
  barriers?: string;
  facilitators?: string;
  mealsLogged?: string;
  notes?: string;
}

const SubmitPortalAdherenceInputSchema = z.object({
  date: z.string().optional(),
  adherenceMenu: z.number(),
  adherenceWater: z.number(),
  adherenceActivity: z.number(),
  adherenceSupplements: z.number(),
  adherenceSleep: z.number(),
  hungerAvg: z.number().nullable().optional(),
  satietyAvg: z.number().nullable().optional(),
  moodAvg: z.number().nullable().optional(),
  energyAvg: z.number().nullable().optional(),
  intercurrentEvents: z.string().optional(),
  barriers: z.string().optional(),
  facilitators: z.string().optional(),
  mealsLogged: z.string().optional(),
  notes: z.string().optional(),
});

const PendingPortalAdherenceSubmissionSchema = z.object({
  id: z.string(),
  input: SubmitPortalAdherenceInputSchema,
  createdAt: z.string(),
  attempts: z.number(),
  lastError: z.string().optional(),
});

const PendingPortalAdherenceQueueSchema = z.array(
  PendingPortalAdherenceSubmissionSchema,
);

export interface PatientPortalPayloadCacheResult {
  data: PatientPortalPayload;
  source: PortalCacheSource;
  cachedAt: string;
  error?: string;
}

export interface PortalNotificationsCacheResult {
  notifications: PortalNotification[];
  source: PortalCacheSource;
  cachedAt: string;
  error?: string;
}

export type PendingPortalAdherenceSubmission = z.infer<
  typeof PendingPortalAdherenceSubmissionSchema
>;

export type PortalAdherenceSubmissionResult =
  | { status: "submitted"; record: PortalAdherenceRecord }
  | { status: "queued"; pending: PendingPortalAdherenceSubmission };

export interface PortalAdherenceFlushResult {
  submitted: number;
  failed: number;
  remaining: number;
}

function getPortalStorage(): Storage | null {
  try {
    return (
      (globalThis as typeof globalThis & { localStorage?: Storage })
        .localStorage ?? null
    );
  } catch {
    return null;
  }
}

function portalStorageKey(prefix: string, token: string): string {
  return `${prefix}${encodeURIComponent(token)}`;
}

function readPortalStorage<T>(key: string, schema: z.ZodType<T>): T | null {
  const storage = getPortalStorage();
  if (!storage) return null;

  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    storage.removeItem(key);
    return null;
  }
}

function writePortalStorage(key: string, value: unknown): boolean {
  const storage = getPortalStorage();
  if (!storage) return false;

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removePortalStorage(key: string): void {
  const storage = getPortalStorage();
  if (!storage) return;
  storage.removeItem(key);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Network failure";
}

function shouldUsePortalCache(error: unknown): boolean {
  return (
    error instanceof NetworkError ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  );
}

function createPendingId(): string {
  const cryptoApi = (globalThis as typeof globalThis & { crypto?: Crypto })
    .crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function saveCachedPatientPortalPayload(
  token: string,
  data: PatientPortalPayload,
): string | null {
  const cachedAt = new Date().toISOString();
  const saved = writePortalStorage(
    portalStorageKey(PORTAL_PAYLOAD_CACHE_PREFIX, token),
    {
      version: PORTAL_CACHE_VERSION,
      cachedAt,
      data,
    },
  );
  return saved ? cachedAt : null;
}

export function getCachedPatientPortalPayload(
  token: string,
): PatientPortalPayloadCacheResult | null {
  const cached = readPortalStorage(
    portalStorageKey(PORTAL_PAYLOAD_CACHE_PREFIX, token),
    PatientPortalPayloadCacheSchema,
  );
  if (!cached) return null;
  return { data: cached.data, source: "cache", cachedAt: cached.cachedAt };
}

function saveCachedPortalNotifications(
  token: string,
  notifications: PortalNotification[],
): string | null {
  const cachedAt = new Date().toISOString();
  const saved = writePortalStorage(
    portalStorageKey(PORTAL_NOTIFICATIONS_CACHE_PREFIX, token),
    {
      version: PORTAL_CACHE_VERSION,
      cachedAt,
      notifications,
    },
  );
  return saved ? cachedAt : null;
}

export function getCachedPortalNotifications(
  token: string,
): PortalNotificationsCacheResult | null {
  const cached = readPortalStorage(
    portalStorageKey(PORTAL_NOTIFICATIONS_CACHE_PREFIX, token),
    PortalNotificationsCacheSchema,
  );
  if (!cached) return null;
  return {
    notifications: cached.notifications,
    source: "cache",
    cachedAt: cached.cachedAt,
  };
}

export function getPendingPortalAdherenceSubmissions(
  token: string,
): PendingPortalAdherenceSubmission[] {
  return (
    readPortalStorage(
      portalStorageKey(PORTAL_ADHERENCE_QUEUE_PREFIX, token),
      PendingPortalAdherenceQueueSchema,
    ) ?? []
  );
}

function savePendingPortalAdherenceSubmissions(
  token: string,
  submissions: PendingPortalAdherenceSubmission[],
): boolean {
  const key = portalStorageKey(PORTAL_ADHERENCE_QUEUE_PREFIX, token);
  if (submissions.length === 0) {
    removePortalStorage(key);
    return true;
  }
  return writePortalStorage(key, submissions);
}

export function queuePortalAdherenceSubmission(
  token: string,
  input: SubmitPortalAdherenceInput,
  lastError?: string,
): PendingPortalAdherenceSubmission {
  const pending: PendingPortalAdherenceSubmission = {
    id: createPendingId(),
    input,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError,
  };
  const saved = savePendingPortalAdherenceSubmissions(token, [
    ...getPendingPortalAdherenceSubmissions(token),
    pending,
  ]);
  if (!saved)
    throw new Error("Could not save the adherence record for offline sync.");
  return pending;
}

export async function getPatientPortalPayload(
  token: string,
  signal?: AbortSignal,
): Promise<PatientPortalPayload> {
  const response = await httpRequest<unknown>(
    `/patient-portal/${encodeURIComponent(token)}`,
    {
      skipAuth: true,
      skipSucursalHeader: true,
      signal,
    },
  );
  return PatientPortalPayloadSchema.parse(response);
}

export async function getPatientPortalPayloadWithCache(
  token: string,
  signal?: AbortSignal,
): Promise<PatientPortalPayloadCacheResult> {
  try {
    const data = await getPatientPortalPayload(token, signal);
    const cachedAt =
      saveCachedPatientPortalPayload(token, data) ?? new Date().toISOString();
    return { data, source: "network", cachedAt };
  } catch (error) {
    if (signal?.aborted || !shouldUsePortalCache(error)) throw error;

    const cached = getCachedPatientPortalPayload(token);
    if (cached) return { ...cached, error: errorMessage(error) };
    throw error;
  }
}

export async function listPatientPortalLinks(
  pacienteId: string,
  signal?: AbortSignal,
): Promise<PortalLink[]> {
  const response = await httpRequest<unknown>("/patient-portal/tokens", {
    query: { pacienteId },
    signal,
  });
  return PortalLinksResponseSchema.parse(response).tokens;
}

export async function createPatientPortalLink(
  input: CreatePortalLinkInput,
): Promise<CreatePortalLinkResponse> {
  const response = await httpRequest<unknown>("/patient-portal/tokens", {
    method: "POST",
    body: input,
  });
  return CreatePortalLinkResponseSchema.parse(response);
}

export async function revokePatientPortalLink(id: string): Promise<PortalLink> {
  const response = await httpRequest<unknown>(
    `/patient-portal/tokens/${encodeURIComponent(id)}/revoke`,
    {
      method: "PATCH",
    },
  );
  return RevokePortalLinkResponseSchema.parse(response).token;
}

export async function listPatientPortalAdherence(
  pacienteId: string,
  signal?: AbortSignal,
): Promise<PortalAdherenceRecord[]> {
  const response = await httpRequest<unknown>("/patient-portal/adherence", {
    query: { pacienteId },
    signal,
  });
  return z
    .object({ records: z.array(PortalAdherenceRecordSchema) })
    .parse(response).records;
}

/** Base URL del backend para construir URLs absolutas de descarga. */
function getBackendBaseUrl(): string {
  const fromVite = (import.meta as unknown as { env?: Record<string, string> })
    .env?.VITE_API_URL;
  if (fromVite) return fromVite;
  const fromProcess =
    typeof process !== "undefined" ? process.env?.VITE_API_URL : undefined;
  return fromProcess ?? "http://localhost:3000";
}

const PortalMessageSchema = z.object({
  id: z.string(),
  tokenId: z.string(),
  pacienteId: z.string(),
  sucursalId: z.string(),
  profesionalId: z.string().nullable(),
  content: z.string(),
  direction: z.enum(["patient_to_professional", "professional_to_patient"]),
  readAt: z.string().nullable(),
  createdAt: z.string().nullable(),
});

const PortalMessagesResponseSchema = z.object({
  messages: z.array(PortalMessageSchema),
});

const SendPortalMessageResponseSchema = z.object({
  message: PortalMessageSchema,
});

export type PortalMessage = z.infer<typeof PortalMessageSchema>;

export async function listPatientPortalMessages(
  token: string,
  signal?: AbortSignal,
): Promise<PortalMessage[]> {
  const response = await httpRequest<unknown>(
    `/patient-portal/${encodeURIComponent(token)}/messages`,
    { skipAuth: true, skipSucursalHeader: true, signal },
  );
  return PortalMessagesResponseSchema.parse(response).messages;
}

export async function sendPatientPortalMessage(
  token: string,
  content: string,
): Promise<PortalMessage> {
  const response = await httpRequest<unknown>(
    `/patient-portal/${encodeURIComponent(token)}/messages`,
    {
      method: "POST",
      body: { content },
      skipAuth: true,
      skipSucursalHeader: true,
    },
  );
  return SendPortalMessageResponseSchema.parse(response).message;
}

export async function listProfessionalMessages(
  pacienteId: string,
  signal?: AbortSignal,
): Promise<PortalMessage[]> {
  const response = await httpRequest<unknown>("/patient-portal/messages", {
    query: { pacienteId },
    signal,
  });
  return PortalMessagesResponseSchema.parse(response).messages;
}

export async function sendProfessionalMessage(
  pacienteId: string,
  content: string,
): Promise<PortalMessage> {
  const response = await httpRequest<unknown>("/patient-portal/messages", {
    method: "POST",
    body: { pacienteId, content },
  });
  return SendPortalMessageResponseSchema.parse(response).message;
}

export async function markMessageAsRead(
  messageId: string,
): Promise<PortalMessage> {
  const response = await httpRequest<unknown>(
    `/patient-portal/messages/${encodeURIComponent(messageId)}/read`,
    { method: "PATCH" },
  );
  return SendPortalMessageResponseSchema.parse(response).message;
}

/** URL para descargar un documento del portal. */
export function getDocumentDownloadUrl(
  token: string,
  documentId: string,
): string {
  return `${getBackendBaseUrl()}/patient-portal/${encodeURIComponent(token)}/documents/${encodeURIComponent(documentId)}/download`;
}

/** URL para previsualizar un documento del portal en el navegador. */
export function getDocumentPreviewUrl(
  token: string,
  documentId: string,
): string {
  return `${getBackendBaseUrl()}/patient-portal/${encodeURIComponent(token)}/documents/${encodeURIComponent(documentId)}/download?preview=1`;
}

export async function sendPortalReminder(
  token: string,
  signal?: AbortSignal,
): Promise<{
  sent: boolean;
  messageId?: string;
  to?: string;
  appointmentDate?: string;
}> {
  const response = await httpRequest<unknown>(
    `/patient-portal/${encodeURIComponent(token)}/send-reminder`,
    {
      method: "POST",
      skipAuth: true,
      skipSucursalHeader: true,
      signal,
    },
  );
  return z
    .object({
      sent: z.boolean(),
      messageId: z.string().optional(),
      to: z.string().optional(),
      appointmentDate: z.string().optional(),
    })
    .parse(response);
}

export async function getPortalNotifications(
  token: string,
  signal?: AbortSignal,
): Promise<PortalNotification[]> {
  const response = await httpRequest<unknown>(
    `/patient-portal/${encodeURIComponent(token)}/notifications`,
    {
      skipAuth: true,
      skipSucursalHeader: true,
      signal,
    },
  );
  return z
    .object({ notifications: z.array(PortalNotificationSchema) })
    .parse(response).notifications;
}

export async function getPortalNotificationsWithCache(
  token: string,
  signal?: AbortSignal,
): Promise<PortalNotificationsCacheResult> {
  try {
    const notifications = await getPortalNotifications(token, signal);
    const cachedAt =
      saveCachedPortalNotifications(token, notifications) ??
      new Date().toISOString();
    return { notifications, source: "network", cachedAt };
  } catch (error) {
    if (signal?.aborted || !shouldUsePortalCache(error)) throw error;

    const cached = getCachedPortalNotifications(token);
    if (cached) return { ...cached, error: errorMessage(error) };
    throw error;
  }
}

export async function submitPatientPortalAdherence(
  token: string,
  input: SubmitPortalAdherenceInput,
): Promise<PortalAdherenceRecord> {
  const response = await httpRequest<unknown>(
    `/patient-portal/${encodeURIComponent(token)}/adherence`,
    {
      method: "POST",
      body: input,
      skipAuth: true,
      skipSucursalHeader: true,
    },
  );
  return SubmitPortalAdherenceResponseSchema.parse(response).record;
}

export async function submitPatientPortalAdherenceWithQueue(
  token: string,
  input: SubmitPortalAdherenceInput,
): Promise<PortalAdherenceSubmissionResult> {
  try {
    const record = await submitPatientPortalAdherence(token, input);
    return { status: "submitted", record };
  } catch (error) {
    if (!shouldUsePortalCache(error)) throw error;
    const pending = queuePortalAdherenceSubmission(
      token,
      input,
      errorMessage(error),
    );
    return { status: "queued", pending };
  }
}

export async function flushPendingPortalAdherenceSubmissions(
  token: string,
): Promise<PortalAdherenceFlushResult> {
  const activeFlush = portalAdherenceFlushes.get(token);
  if (activeFlush) return activeFlush;

  const flush = flushPendingPortalAdherenceSubmissionsNow(token);
  portalAdherenceFlushes.set(token, flush);
  try {
    return await flush;
  } finally {
    if (portalAdherenceFlushes.get(token) === flush)
      portalAdherenceFlushes.delete(token);
  }
}

async function flushPendingPortalAdherenceSubmissionsNow(
  token: string,
): Promise<PortalAdherenceFlushResult> {
  const queue = getPendingPortalAdherenceSubmissions(token);
  if (queue.length === 0) return { submitted: 0, failed: 0, remaining: 0 };

  let submitted = 0;
  let failed = 0;
  const remaining: PendingPortalAdherenceSubmission[] = [];

  for (const item of queue) {
    try {
      await submitPatientPortalAdherence(token, item.input);
      submitted += 1;
    } catch (error) {
      failed += 1;
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        lastError: errorMessage(error),
      });
    }
  }

  savePendingPortalAdherenceSubmissions(token, remaining);
  return { submitted, failed, remaining: remaining.length };
}
