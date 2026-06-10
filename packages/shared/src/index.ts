export const RoleSchema = {
  ADMIN: 'admin',
  NUTRIOLOGA: 'nutriologa',
  ASISTENTE: 'asistente',
  SOPORTE: 'soporte_tecnico',
  AUDITOR: 'auditor',
  FACTURACION: 'facturacion',
} as const;

export type Role = (typeof RoleSchema)[keyof typeof RoleSchema];

export const ALL_ROLES: Role[] = Object.values(RoleSchema);

export const RoleLabel: Record<Role, string> = {
  admin: 'Administrador',
  nutriologa: 'Nutrióloga titular',
  asistente: 'Asistente',
  soporte_tecnico: 'Soporte técnico',
  auditor: 'Auditor',
  facturacion: 'Facturación',
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

export interface JwtPayload {
  sub: string;
  email: string;
  rol: Role;
  sucursalIds: string[];
  totpVerified?: boolean;
  iat: number;
  exp: number;
}

export const SYNC_SCHEMA_VERSION = 1;
export const API_VERSION = 'v1';

export const SYNCABLE_ENTITIES = [
  'pacientes',
  'consultas',
  'antropometrias',
  'lab_panels',
  'planes_alimenticios',
  'adherence_records',
] as const;

export type SyncableEntity = (typeof SYNCABLE_ENTITIES)[number];

export interface SyncPushOperation {
  entity: SyncableEntity;
  id: string;
  op: 'create' | 'update' | 'delete';
  payload: unknown;
  clientUpdatedAt: string;
  expectedRowVersion?: string;
}

export interface SyncPushBatch {
  sucursalId: string;
  operations: SyncPushOperation[];
}

export interface SyncPushResultItem {
  entity: SyncableEntity;
  id: string;
  status: 'applied' | 'skipped' | 'conflict' | 'error';
  serverUpdatedAt?: string;
  serverRowVersion?: string;
  error?: string;
}

export interface SyncPushResponse {
  results: SyncPushResultItem[];
  serverTime: string;
}

export interface SyncPullResponse {
  serverTime: string;
  changes: SyncPullChange[];
  hasMore: boolean;
  nextSince: string;
}

export interface SyncPullChange {
  entity: SyncableEntity;
  id: string;
  op: 'create' | 'update' | 'delete';
  payload: unknown;
  serverUpdatedAt: string;
  serverRowVersion: string;
}

export interface SyncManifest {
  apiVersion: string;
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
  estado: 'pendiente' | 'activa' | 'finalizada' | 'cancelada';
  scheduledAt: string | null;
  iniciadaAt: string | null;
  finalizadaAt: string | null;
  notas: string | null;
  createdAt: string;
}
