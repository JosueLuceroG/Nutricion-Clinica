export const RoleSchema = {
  ADMIN: "admin",
  NUTRIOLOGA: "nutriologa",
  ASISTENTE: "asistente",
  SOPORTE: "soporte_tecnico",
  AUDITOR: "auditor",
  FACTURACION: "facturacion",
} as const;

export type Role = (typeof RoleSchema)[keyof typeof RoleSchema];

export const ALL_ROLES: Role[] = Object.values(RoleSchema);

export const RoleLabel: Record<Role, string> = {
  admin: "Administrador",
  nutriologa: "Nutrióloga titular",
  asistente: "Asistente",
  soporte_tecnico: "Soporte técnico",
  auditor: "Auditor",
  facturacion: "Facturación",
};

export interface SucursalDTO {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSucursalDTO {
  id: string;
  nombre: string;
  esTitular: boolean;
}

export interface ProfesionalDTO {
  id: string;
  email: string;
  nombreCompleto: string;
  cedulaProfesional: string | null;
  rol: Role;
  sucursalIds: string[];
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthProfesionalDTO {
  id: string;
  email: string;
  nombreCompleto: string;
  rol: Role;
}

export interface AuthResponse {
  token: string;
  profesional: AuthProfesionalDTO;
  sucursales: AuthSucursalDTO[];
  sucursalActivaId: string | null;
  requires2fa?: boolean;
  pending2faToken?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  sucursalId?: string;
  totpCode?: string;
  pending2faToken?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  nombreCompleto: string;
  cedulaProfesional?: string;
  rol: Role;
  telefono?: string;
  sucursalIds: string[];
}

export const SENSITIVE_ACTIONS = ["backup.export", "backup.restore"] as const;

export type SensitiveAction = (typeof SENSITIVE_ACTIONS)[number];

export interface SensitiveActionGrantRequest {
  action: SensitiveAction;
  password: string;
  totpCode?: string;
}

export interface SensitiveActionGrantResponse {
  grant: string;
  expiresAt: string;
}

export interface ConsumeSensitiveActionGrantRequest {
  action: SensitiveAction;
  grant: string;
}

export interface WsTicketResponse {
  ticket: string;
  expiresAt: string;
}

export const WS_TICKET_PROTOCOL = "nutriclinica-ticket";

export const TURN_CONNECTIVITY_POLICY = "OPTIONAL_DIRECT_ALLOWED" as const;

export interface TurnIceServerDTO {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface TurnConfigDTO {
  policy: typeof TURN_CONNECTIVITY_POLICY;
  iceServers: TurnIceServerDTO[];
  /** True only when a credentialed TURN relay is present. */
  configured: boolean;
}

export type JwtTokenType = "access" | "pending_2fa";

interface JwtStandardClaims {
  iat: number;
  exp: number;
  iss: string;
  aud: string | string[];
}

export interface JwtPayload extends JwtStandardClaims {
  tokenType: "access";
  sub: string;
  email: string;
  rol: Role;
  sucursalIds: string[];
  totpVerified: boolean;
  ver: number;
}

export interface Pending2faTokenPayload extends JwtStandardClaims {
  tokenType: "pending_2fa";
  sub: string;
  email: string;
}

export const SYNC_SCHEMA_VERSION = 2;
export { canonicalSyncId, isSyncRowVersion, toApiPayload, toLocalPayload } from "./syncPayloadMapping.js";
export const API_VERSION = "v1";
export const SYNC_OPERATION_CONTRACT = "durable-outbox-v1" as const;
/** Versión del esquema Dexie del cliente (fuente única: src/services/db/dexieSchema.ts, cadena final). */
export const DEXIE_SCHEMA_VERSION = 33;

export const SYNCABLE_ENTITIES = [
  "pacientes",
  "consultas",
  "antropometrias",
  "lab_panels",
  "planes_alimenticios",
  "adherence_records",
] as const;

export type SyncableEntity = (typeof SYNCABLE_ENTITIES)[number];

export interface SyncPushOperation {
  /** Stable identity of the exact revision, preserved across retries. */
  operationId: string;
  /** Explicit user restoration based on an observed tombstone version. */
  restoreDeleted?: boolean;
  entity: SyncableEntity;
  id: string;
  op: "create" | "update" | "delete";
  payload: unknown;
  clientUpdatedAt: string;
  expectedRowVersion?: string;
}

export interface SyncPushBatch {
  sucursalId: string;
  operations: SyncPushOperation[];
}

export interface SyncPushResultItem {
  operationId: string;
  entity: SyncableEntity;
  id: string;
  status: "applied" | "skipped" | "conflict" | "error";
  serverUpdatedAt?: string;
  serverRowVersion?: string;
  error?: string;
  serverPayload?: Record<string, unknown> | null;
  serverDeleted?: boolean;
}

export interface SyncPushResponse {
  results: SyncPushResultItem[];
  serverTime: string;
}

export type SyncPullCursors = Partial<Record<SyncableEntity, string>>;

export interface SyncPullRequest {
  since: SyncPullCursors | null;
}

export interface SyncPullResponse {
  serverTime: string;
  changes: SyncPullChange[];
  hasMore: boolean;
  cursors: SyncPullCursors;
}

export interface SyncPullChange {
  entity: SyncableEntity;
  id: string;
  op: "create" | "update" | "delete";
  payload: unknown;
  /** Reduced role-specific projection; it may only patch an existing local row. */
  partial?: boolean;
  serverUpdatedAt: string;
  serverRowVersion: string;
}

export interface SyncManifest {
  operationContract: typeof SYNC_OPERATION_CONTRACT;
  apiVersion: string;
  apiContractVersion: string;
  syncSchemaVersion: number;
  serverTime: string;
  entities: SyncableEntity[];
  maxBatchSize: number;
  supportsDelta: boolean;
}

export interface TelemedicinaSalaDTO {
  id: string;
  pacienteId: string;
  profesionalId: string;
  sucursalId: string;
  estado: "pendiente" | "activa" | "finalizada" | "cancelada";
  scheduledAt: string | null;
  iniciadaAt: string | null;
  finalizadaAt: string | null;
  notas: string | null;
  createdAt: string;
}

export interface TelemedicinaGrabacionDTO {
  id: string;
  salaId: string;
  sucursalId: string;
  createdBy: string;
  createdAt: string;
  durationMs: number;
  mimeType: string;
  originalSizeBytes: number;
  encryptedSizeBytes: number;
  iv: string;
  consentAcceptedAt: string;
  consentTextVersion: string;
}
